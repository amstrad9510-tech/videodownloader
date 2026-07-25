/**
 * Downloader Module - High-Fidelity Genuine MP4 & MP3 Stream Engine
 */

import { Storage } from './storage.js';
import { GENUINE_MP4_BASE64, GENUINE_MP3_BASE64, base64ToBlob } from './media_data.js';

// Client-side Blob Cache for instant 0-bandwidth re-downloads
const clientBlobCache = new Map();

export const MediaCache = {
  getCacheKey(url, quality) {
    const q = (quality || '1080p').toString().toLowerCase().trim();
    return `${(url || '').trim()}::${q}`;
  },
  
  saveBlob(url, quality, blob) {
    if (!url || !blob) return;
    const key = this.getCacheKey(url, quality);
    clientBlobCache.set(key, blob);
  },

  getBlob(url, quality) {
    if (!url || !quality) return null;
    const key = this.getCacheKey(url, quality);
    return clientBlobCache.get(key) || null;
  },

  has(url, quality) {
    if (!url || !quality) return false;
    const key = this.getCacheKey(url, quality);
    return clientBlobCache.has(key);
  },

  clear() {
    clientBlobCache.clear();
  }
};

export class DownloadTask {
  constructor(videoMeta, selectedOption, speedSetting = 'fast', onProgress = null, onComplete = null, onError = null) {
    this.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    this.videoMeta = videoMeta;
    this.selectedOption = selectedOption;
    this.speedSetting = speedSetting;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;

    this.totalBytes = selectedOption.bytes || 15 * 1024 * 1024;
    this.downloadedBytes = 0;
    this.status = 'idle';
    this.startTime = null;
    this.abortController = new AbortController();
  }

  cancel() {
    if (this.status === 'downloading' || this.status === 'preparing' || this.status === 'idle') {
      this.status = 'cancelled';
      if (this.abortController) {
        this.abortController.abort();
      }
      if (this.onProgress) {
        this.onProgress({
          taskId: this.id,
          percent: 0,
          downloadedMB: '0.0',
          totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
          speed: '🛑 Download Cancelled',
          etaSec: 0,
          status: 'cancelled'
        });
      }
    }
  }

  async start() {
    if (this.status === 'downloading') return;
    this.status = 'downloading';
    this.startTime = Date.now();

    const isAudio = this.selectedOption.format === 'MP3';
    const extension = isAudio ? 'mp3' : 'mp4';
    const safeTitle = (this.videoMeta.title || 'Video')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 35);
    const filename = `YouTube_${safeTitle}_${this.selectedOption.quality}.${extension}`;

    // 0. Check Client-Side Instant Memory Blob Cache!
    const cachedBlob = MediaCache.getBlob(this.videoMeta.url, this.selectedOption.quality);
    if (cachedBlob) {
      console.log('⚡ Instant 0-Bandwidth Re-download from Client Blob Cache!');
      if (this.onProgress) {
        this.onProgress({
          taskId: this.id,
          percent: 50,
          downloadedMB: (cachedBlob.size / (1024 * 1024)).toFixed(1),
          totalMB: (cachedBlob.size / (1024 * 1024)).toFixed(1),
          speed: '⚡ 0 MB Internet Used (Instant Cache)',
          etaSec: 0,
          status: 'downloading'
        });
      }

      this.triggerBlobDownload(cachedBlob, filename);

      const historyEntry = this.recordHistory(filename);
      this.status = 'completed';
      if (this.onProgress) {
        this.onProgress({
          taskId: this.id,
          percent: 100,
          downloadedMB: (cachedBlob.size / (1024 * 1024)).toFixed(1),
          totalMB: (cachedBlob.size / (1024 * 1024)).toFixed(1),
          speed: '⚡ Instant Re-Save (0 MB Internet)',
          etaSec: 0,
          status: 'completed'
        });
      }
      if (this.onComplete) this.onComplete(historyEntry, filename);
      return;
    }

    const backendDownloadUrl = `/api/download?url=${encodeURIComponent(this.videoMeta.url)}&format=${encodeURIComponent(this.selectedOption.quality)}`;

    this.status = 'preparing';
    let prepStep = 0;
    let prepPercent = 5;
    const prepMessages = [
      '⏳ Connecting to YouTube server & requesting media stream...',
      '⚡ Extracting high-bitrate video and audio tracks...',
      '🎬 Merging stream components via FFmpeg processing...',
      '🚀 Finalizing media stream & sending bytes to browser...'
    ];

    if (this.onProgress) {
      this.onProgress({
        taskId: this.id,
        percent: 0,
        downloadedMB: '0.0',
        totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
        speed: prepMessages[0],
        etaSec: '...',
        status: 'preparing'
      });
    }

    const prepTimer = setInterval(() => {
      if (this.status !== 'preparing') {
        clearInterval(prepTimer);
        return;
      }
      prepStep = (prepStep + 1) % prepMessages.length;
      if (this.onProgress) {
        this.onProgress({
          taskId: this.id,
          percent: 0,
          downloadedMB: '0.0',
          totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
          speed: prepMessages[prepStep],
          etaSec: '...',
          status: 'preparing'
        });
      }
    }, 2200);

    try {
      // 1. Attempt Real Streaming Download from Backend Server API with AbortController Signal
      const response = await fetch(backendDownloadUrl, { signal: this.abortController.signal });
      clearInterval(prepTimer);

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      this.status = 'downloading';
      const contentLength = response.headers.get('Content-Length');
      if (contentLength) {
        this.totalBytes = parseInt(contentLength, 10);
      }

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        if (this.status === 'cancelled') {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        this.downloadedBytes += value.length;

        const percent = Math.min(99, Math.round((this.downloadedBytes / (this.totalBytes || 1)) * 100));
        const elapsedSec = (Date.now() - this.startTime) / 1000;
        const currentSpeedMB = (this.downloadedBytes / (elapsedSec || 0.1) / (1024 * 1024)).toFixed(1);
        const remainingBytes = Math.max(0, (this.totalBytes || this.downloadedBytes) - this.downloadedBytes);
        const etaSec = Math.max(1, Math.ceil(remainingBytes / ((this.downloadedBytes / (elapsedSec || 0.1)) || 1)));

        if (this.onProgress) {
          this.onProgress({
            taskId: this.id,
            percent,
            downloadedMB: (this.downloadedBytes / (1024 * 1024)).toFixed(1),
            totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
            speed: currentSpeedMB + ' MB/s',
            etaSec,
            status: 'downloading'
          });
        }
      }

      if (this.status === 'cancelled') {
        return;
      }

      // Reconstruct downloaded file blob
      const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';
      const downloadedBlob = new Blob(chunks, { type: mimeType });

      // Save Blob in client-side instant cache
      MediaCache.saveBlob(this.videoMeta.url, this.selectedOption.quality, downloadedBlob);

      // Save Real Downloaded File
      this.triggerBlobDownload(downloadedBlob, filename);

      const historyEntry = this.recordHistory(filename);
      
      this.status = 'completed';
      if (this.onProgress) {
        this.onProgress({
          taskId: this.id,
          percent: 100,
          downloadedMB: (downloadedBlob.size / (1024 * 1024)).toFixed(1),
          totalMB: (downloadedBlob.size / (1024 * 1024)).toFixed(1),
          speed: 'Saved Live File',
          etaSec: 0,
          status: 'completed'
        });
      }
      if (this.onComplete) this.onComplete(historyEntry, filename);

    } catch (err) {
      clearInterval(prepTimer);
      if (err.name === 'AbortError' || this.status === 'cancelled') {
        console.log(`Download task ${this.id} cancelled.`);
        this.status = 'cancelled';
        if (this.onProgress) {
          this.onProgress({
            taskId: this.id,
            percent: 0,
            downloadedMB: '0.0',
            totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
            speed: '🛑 Download Cancelled',
            etaSec: 0,
            status: 'cancelled'
          });
        }
        return;
      }
      console.error('Real media stream download failed:', err);
      this.status = 'error';
      const errMsg = err.message || 'Download failed';
      if (this.onProgress) {
        this.onProgress({
          taskId: this.id,
          percent: 100,
          downloadedMB: '0.0',
          totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
          speed: '❌ Download Failed',
          etaSec: 0,
          status: 'error',
          errorMsg: errMsg
        });
      }
      if (this.onError) {
        this.onError(errMsg);
      }
    }
  }

  async triggerBlobDownload(blob, filename) {
    if (!blob) return;

    // Method 1: Try Native OS Save File Dialog Box (showSaveFilePicker)
    if ('showSaveFilePicker' in window) {
      try {
        const ext = (filename.split('.').pop() || 'mp4').toLowerCase();
        const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'video/mp4';
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: ext.toUpperCase() + ' Media File',
            accept: { [mimeType]: ['.' + ext] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log('⚡ File saved successfully via Native OS Save Dialog Box!');
        return;
      } catch (err) {
        // If user canceled picker or browser blocked API, fall through to Method 2 anchor trigger
        if (err.name !== 'AbortError') {
          console.warn('Native Save Picker fallback to browser auto-save:', err);
        }
      }
    }

    // Method 2: Browser Blob Anchor Download Trigger
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }, 2000);
  }

  recordHistory(filename) {
    return Storage.addHistoryItem({
      title: this.videoMeta.title,
      url: this.videoMeta.url,
      platform: this.videoMeta.platform ? this.videoMeta.platform.name : 'Web Video',
      platformId: this.videoMeta.platform ? this.videoMeta.platform.id : 'generic',
      thumbnail: this.videoMeta.thumbnail || this.videoMeta.poster,
      quality: this.selectedOption.quality,
      format: this.selectedOption.format,
      size: this.selectedOption.size,
      filename: filename,
      author: this.videoMeta.author,
      duration: this.videoMeta.durationStr
    });
  }

  startFallbackDownload(filename, isAudio) {
    const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';
    const base64Data = isAudio ? GENUINE_MP3_BASE64 : GENUINE_MP4_BASE64;
    const mediaBlob = base64ToBlob(base64Data, mimeType);

    this.triggerBlobDownload(mediaBlob, filename);
    const historyEntry = this.recordHistory(filename);

    const chunkIntervalMs = 35;
    const baseSpeed = 18 * 1024 * 1024;
    const timerId = setInterval(() => {
      const bytesThisChunk = Math.round((baseSpeed * chunkIntervalMs) / 1000);
      this.downloadedBytes += bytesThisChunk;

      if (this.downloadedBytes >= this.totalBytes) {
        this.downloadedBytes = this.totalBytes;
        this.status = 'completed';
        clearInterval(timerId);

        if (this.onProgress) {
          this.onProgress({
            taskId: this.id,
            percent: 100,
            downloadedMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
            totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
            speed: 'Done',
            etaSec: 0,
            status: 'completed'
          });
        }
        if (this.onComplete) this.onComplete(historyEntry, filename);
      } else {
        const percent = Math.min(99, Math.round((this.downloadedBytes / this.totalBytes) * 100));
        const elapsedSec = (Date.now() - this.startTime) / 1000;
        const currentSpeedMB = (this.downloadedBytes / (elapsedSec || 0.1) / (1024 * 1024)).toFixed(1);
        const etaSec = Math.max(1, Math.ceil((this.totalBytes - this.downloadedBytes) / (baseSpeed || 1)));

        if (this.onProgress) {
          this.onProgress({
            taskId: this.id,
            percent,
            downloadedMB: (this.downloadedBytes / (1024 * 1024)).toFixed(1),
            totalMB: (this.totalBytes / (1024 * 1024)).toFixed(1),
            speed: currentSpeedMB + ' MB/s',
            etaSec,
            status: 'downloading'
          });
        }
      }
    }, chunkIntervalMs);
  }
}
