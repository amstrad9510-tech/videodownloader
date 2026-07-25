/**
 * LinkVideo Downloader - Main Application Entry
 */

import { Storage } from './modules/storage.js';
import { fetchVideoMetadata, SAMPLE_LINKS, isValidUrl, formatDuration, generateFormatOptions } from './modules/metadata.js';
import { DownloadTask } from './modules/downloader.js';
import { Toast } from './modules/toast.js';
import { Clipboard } from './modules/clipboard.js';

class LinkVideoApp {
  constructor() {
    this.currentMetadata = null;
    this.activeTasks = new Map();

    // Cache DOM Elements
    this.elements = {
      navTabs: document.querySelectorAll('.nav-tab'),
      tabPanes: document.querySelectorAll('.tab-pane'),
      themeToggleBtn: document.getElementById('theme-toggle-btn'),
      brandLogoBtn: document.getElementById('brand-logo-btn'),
      
      // Home Tab Elements
      downloaderBox: document.getElementById('downloader-box'),
      urlForm: document.getElementById('url-form'),
      urlInput: document.getElementById('url-input'),
      pasteBtn: document.getElementById('paste-btn'),
      clearBtn: document.getElementById('clear-btn'),
      fetchBtn: document.getElementById('fetch-btn'),
      sampleChipsContainer: document.getElementById('sample-chips-container'),
      skeletonCard: document.getElementById('skeleton-card'),
      videoPreviewCard: document.getElementById('video-preview-card'),
      previewPlayerContainer: document.getElementById('preview-player-container'),
      
      // Preview Card Sub-elements
      previewPlatformBadge: document.getElementById('preview-platform-badge'),
      previewTitle: document.getElementById('preview-title'),
      previewAuthor: document.getElementById('preview-author'),
      previewDuration: document.getElementById('preview-duration'),
      previewViews: document.getElementById('preview-views'),
      qualitiesList: document.getElementById('qualities-list'),

      // Active Downloads Elements
      activeDownloadsCard: document.getElementById('active-downloads-card'),
      activeProgressContainer: document.getElementById('active-progress-container'),
      activeCountLabel: document.getElementById('active-count-label'),

      // Downloads History Elements
      historyBadgeCount: document.getElementById('history-badge-count'),
      historySearch: document.getElementById('history-search'),
      historyFormatFilter: document.getElementById('history-format-filter'),
      clearHistoryBtn: document.getElementById('clear-history-btn'),
      historyListContainer: document.getElementById('history-list-container'),
      emptyHistoryState: document.getElementById('empty-history-state'),
      statTotalCount: document.getElementById('stat-total-count'),
      statTotalSize: document.getElementById('stat-total-size'),

      // Settings Elements
      settingDefaultQuality: document.getElementById('setting-default-quality'),
      settingAutoPaste: document.getElementById('setting-auto-paste'),
      settingSpeed: document.getElementById('setting-speed'),
      settingTheme: document.getElementById('setting-theme'),
      settingNotifications: document.getElementById('setting-notifications'),
      resetSettingsBtn: document.getElementById('reset-settings-btn')
    };

    this.init();
  }

  init() {
    this.applyInitialSettings();
    this.bindEvents();
    this.renderSampleLinks();
    this.updateHistoryUI();
  }

  /* ==========================================
     SETTINGS & THEME
     ========================================== */
  applyInitialSettings() {
    const settings = Storage.getSettings();

    // Set Theme
    document.documentElement.setAttribute('data-theme', settings.theme);
    this.updateThemeToggleIcon(settings.theme);

    // Populate Settings Controls
    if (this.elements.settingDefaultQuality) this.elements.settingDefaultQuality.value = settings.defaultQuality;
    if (this.elements.settingAutoPaste) this.elements.settingAutoPaste.checked = settings.autoPaste;
    if (this.elements.settingSpeed) this.elements.settingSpeed.value = settings.downloadSpeed;
    if (this.elements.settingTheme) this.elements.settingTheme.value = settings.theme;
    if (this.elements.settingNotifications) this.elements.settingNotifications.checked = settings.notifications;
  }

  updateThemeToggleIcon(theme) {
    if (!this.elements.themeToggleBtn) return;
    if (theme === 'light') {
      this.elements.themeToggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
        </svg>
      `;
    } else {
      this.elements.themeToggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12.3 2a10 10 0 0 0 9.7 12.3 10 10 0 1 1-9.7-12.3z"/>
        </svg>
      `;
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const nextTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    this.updateThemeToggleIcon(nextTheme);
    Storage.saveSettings({ theme: nextTheme });
    if (this.elements.settingTheme) this.elements.settingTheme.value = nextTheme;
    
    this.notify(`Switched to ${nextTheme} theme`, 'info');
  }

  notify(message, type = 'info') {
    const settings = Storage.getSettings();
    if (settings.notifications) {
      Toast.show(message, type);
    }
  }

  /* ==========================================
     EVENT BINDINGS
     ========================================== */
  bindEvents() {
    // Navigation Tabs
    this.elements.navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetTab = tab.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    if (this.elements.brandLogoBtn) {
      this.elements.brandLogoBtn.addEventListener('click', () => {
        this.switchTab('home-tab');
      });
    }

    // Theme Toggle
    if (this.elements.themeToggleBtn) {
      this.elements.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Input URL Events
    if (this.elements.urlInput) {
      this.elements.urlInput.addEventListener('input', () => {
        const val = this.elements.urlInput.value.trim();
        this.elements.clearBtn.style.display = val ? 'flex' : 'none';
      });
    }

    if (this.elements.clearBtn) {
      this.elements.clearBtn.addEventListener('click', () => {
        this.elements.urlInput.value = '';
        this.elements.clearBtn.style.display = 'none';
        this.elements.urlInput.focus();
      });
    }

    // Paste Button
    if (this.elements.pasteBtn) {
      this.elements.pasteBtn.addEventListener('click', async () => {
        const text = await Clipboard.readText();
        if (text) {
          this.elements.urlInput.value = text;
          this.elements.clearBtn.style.display = 'flex';
          this.notify('Link pasted from clipboard', 'success');
          this.handleFetchUrl(text);
        } else {
          this.notify('Clipboard is empty or permission denied', 'warning');
        }
      });
    }

    // URL Form Submission
    if (this.elements.urlForm) {
      this.elements.urlForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = this.elements.urlInput.value.trim();
        this.handleFetchUrl(url);
      });
    }

    // Drag & Drop Link Support
    const box = this.elements.downloaderBox;
    if (box) {
      ['dragenter', 'dragover'].forEach(eventName => {
        box.addEventListener(eventName, (e) => {
          e.preventDefault();
          box.classList.add('drag-over');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        box.addEventListener(eventName, (e) => {
          e.preventDefault();
          box.classList.remove('drag-over');
        }, false);
      });

      box.addEventListener('drop', (e) => {
        const droppedText = e.dataTransfer.getData('text');
        if (droppedText) {
          this.elements.urlInput.value = droppedText.trim();
          this.elements.clearBtn.style.display = 'flex';
          this.notify('Link dropped!', 'info');
          this.handleFetchUrl(droppedText.trim());
        }
      });
    }

    // Downloads History Controls
    if (this.elements.historySearch) {
      this.elements.historySearch.addEventListener('input', () => this.updateHistoryUI());
    }

    if (this.elements.historyFormatFilter) {
      this.elements.historyFormatFilter.addEventListener('change', () => this.updateHistoryUI());
    }

    if (this.elements.clearHistoryBtn) {
      this.elements.clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all download history?')) {
          Storage.clearHistory();
          this.updateHistoryUI();
          this.notify('Download history cleared', 'success');
        }
      });
    }

    // Settings Controls
    if (this.elements.settingDefaultQuality) {
      this.elements.settingDefaultQuality.addEventListener('change', (e) => {
        Storage.saveSettings({ defaultQuality: e.target.value });
        this.notify('Default quality updated to ' + e.target.value, 'info');
      });
    }

    if (this.elements.settingAutoPaste) {
      this.elements.settingAutoPaste.addEventListener('change', (e) => {
        Storage.saveSettings({ autoPaste: e.target.checked });
        this.notify('Auto-paste setting saved', 'info');
      });
    }

    if (this.elements.settingSpeed) {
      this.elements.settingSpeed.addEventListener('change', (e) => {
        Storage.saveSettings({ downloadSpeed: e.target.value });
        this.notify('Simulation speed set to ' + e.target.value, 'info');
      });
    }

    if (this.elements.settingTheme) {
      this.elements.settingTheme.addEventListener('change', (e) => {
        const val = e.target.value;
        document.documentElement.setAttribute('data-theme', val);
        this.updateThemeToggleIcon(val);
        Storage.saveSettings({ theme: val });
        this.notify('Theme changed to ' + val, 'info');
      });
    }

    if (this.elements.settingNotifications) {
      this.elements.settingNotifications.addEventListener('change', (e) => {
        Storage.saveSettings({ notifications: e.target.checked });
      });
    }

    if (this.elements.resetSettingsBtn) {
      this.elements.resetSettingsBtn.addEventListener('click', () => {
        if (confirm('Reset all settings to default?')) {
          localStorage.removeItem('linkvideo_user_settings');
          this.applyInitialSettings();
          this.notify('Settings reset to defaults', 'success');
        }
      });
    }

    // Auto-detect Clipboard link on Window Focus
    window.addEventListener('focus', async () => {
      const settings = Storage.getSettings();
      if (settings.autoPaste && !this.elements.urlInput.value) {
        const clipUrl = await Clipboard.getClipboardVideoUrl();
        if (clipUrl) {
          this.elements.urlInput.value = clipUrl;
          this.elements.clearBtn.style.display = 'flex';
          this.notify('Auto-detected copied video link!', 'info');
        }
      }
    });

    // YouTube Embed Player postMessage Live Duration listener
    window.addEventListener('message', (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data && data.info && data.info.duration && data.info.duration > 0) {
          const sec = Math.round(data.info.duration);
          const mm = Math.floor(sec / 60);
          const ss = (sec % 60).toString().padStart(2, '0');
          const hh = Math.floor(mm / 60);
          const durStr = hh > 0 ? `${hh}:${(mm % 60).toString().padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
          if (this.elements.previewDuration) {
            this.elements.previewDuration.textContent = durStr;
          }
        }
      } catch (err) {}
    });
  }

  switchTab(tabId) {
    this.elements.navTabs.forEach(t => {
      if (t.getAttribute('data-tab') === tabId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    this.elements.tabPanes.forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (tabId === 'downloads-tab') {
      this.updateHistoryUI();
    }
  }

  /* ==========================================
     SAMPLE DEMO CHIPS
     ========================================== */
  renderSampleLinks() {
    if (!this.elements.sampleChipsContainer) return;
    this.elements.sampleChipsContainer.innerHTML = '';

    SAMPLE_LINKS.forEach(sample => {
      const chip = document.createElement('button');
      chip.className = 'sample-chip';
      chip.type = 'button';
      chip.innerHTML = `<span>${sample.label}</span>`;
      chip.addEventListener('click', () => {
        this.elements.urlInput.value = sample.url;
        this.elements.clearBtn.style.display = 'flex';
        this.handleFetchUrl(sample.url);
      });
      this.elements.sampleChipsContainer.appendChild(chip);
    });
  }

  /* ==========================================
     METADATA FETCHING & UI RENDER
     ========================================== */
  async handleFetchUrl(url) {
    if (!isValidUrl(url)) {
      this.notify('Please enter a valid YouTube video link (e.g. https://www.youtube.com/watch?v=...)', 'error');
      return;
    }

    // UI Loading state
    this.elements.videoPreviewCard.classList.remove('active');
    this.elements.skeletonCard.classList.add('active');
    this.elements.fetchBtn.disabled = true;
    this.elements.fetchBtn.innerHTML = `<span>Loading...</span>`;

    try {
      const meta = await fetchVideoMetadata(url);
      this.currentMetadata = meta;

      // Hide skeleton, render preview card
      this.elements.skeletonCard.classList.remove('active');
      this.renderVideoPreviewCard(meta);
      this.elements.videoPreviewCard.classList.add('active');
      this.notify(`Fetched video metadata from ${meta.platform.name}!`, 'success');

      // Scroll to preview card
      this.elements.videoPreviewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      this.elements.skeletonCard.classList.remove('active');
      this.notify(err.message || 'Failed to fetch video metadata', 'error');
    } finally {
      this.elements.fetchBtn.disabled = false;
      this.elements.fetchBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <span>Fetch Video</span>
      `;
    }
  }

  renderVideoPreviewCard(meta) {
    if (this.elements.previewPlayerContainer) {
      const videoId = meta.videoId || '';
      const embedUrl = meta.embedIframeUrl || (videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&enablejsapi=1` : '');
      const thumbMaxRes = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : (meta.thumbnail || '');
      const thumbHq = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : (meta.thumbnail || '');

      if (embedUrl) {
        this.elements.previewPlayerContainer.innerHTML = `
          <iframe src="${embedUrl}" 
                  title="${escapeHtml(meta.title)}"
                  frameborder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowfullscreen 
                  referrerpolicy="strict-origin-when-cross-origin"
                  style="width:100%; height:100%; position:absolute; top:0; left:0; border:none; border-radius: var(--radius-md);"></iframe>
        `;
      } else if (thumbMaxRes) {
        this.elements.previewPlayerContainer.innerHTML = `
          <div style="width:100%; height:100%; position:relative; background:#000; overflow:hidden; border-radius: var(--radius-md);">
            <img src="${thumbMaxRes}" onerror="this.onerror=null; this.src='${thumbHq}';" alt="${escapeHtml(meta.title)}" style="width:100%; height:100%; object-fit:cover;" />
          </div>
        `;
      }
    }

    if (this.elements.previewPlatformBadge) {
      this.elements.previewPlatformBadge.className = `platform-badge ${meta.platform.badgeClass || 'badge-youtube'}`;
      this.elements.previewPlatformBadge.innerHTML = `${meta.platform.iconSvg || ''} <span>${meta.platform.name || 'YouTube'}</span>`;
    }
    
    if (this.elements.previewTitle) this.elements.previewTitle.textContent = meta.title;
    if (this.elements.previewAuthor) this.elements.previewAuthor.textContent = meta.author;
    if (this.elements.previewDuration) this.elements.previewDuration.textContent = meta.durationStr;
    if (this.elements.previewViews) this.elements.previewViews.textContent = meta.viewsStr;

    // Render Qualities Matrix
    this.renderQualitiesList(meta);
  }

  renderQualitiesList(meta) {
    if (!this.elements.qualitiesList) return;
    const settings = Storage.getSettings();
    const defaultFmt = settings.defaultQuality;

    this.elements.qualitiesList.innerHTML = '';

    meta.options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'quality-option-row';

      const isPreferred = opt.quality.toLowerCase() === defaultFmt.toLowerCase();

      row.innerHTML = `
        <div class="quality-info">
          <span class="fmt-badge ${opt.badgeClass}">${opt.badge}</span>
          <div>
            <div class="quality-label-text">${opt.label} ${isPreferred ? '<small style="color: var(--accent-solid); margin-left:6px;">(Default)</small>' : ''}</div>
            <div class="quality-subtext">${opt.fps !== 'N/A' ? opt.fps + ' • ' : ''}${opt.bitrate}</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-secondary);">${opt.size}</span>
          <button class="dl-button" data-quality="${opt.quality}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>Download</span>
          </button>
        </div>
      `;

      const dlBtn = row.querySelector('.dl-button');
      dlBtn.addEventListener('click', () => {
        this.triggerDownload(meta, opt);
      });

      this.elements.qualitiesList.appendChild(row);
    });
  }

  /* ==========================================
     DOWNLOAD PROCESS & PROGRESS WIDGET
     ========================================== */
  triggerDownload(videoMeta, selectedOption) {
    const settings = Storage.getSettings();
    const task = new DownloadTask(
      videoMeta,
      selectedOption,
      settings.downloadSpeed,
      (progressData) => this.onTaskProgress(progressData),
      (historyItem, filename) => this.onTaskComplete(historyItem, filename),
      (err) => this.notify('Download error: ' + err, 'error')
    );

    this.activeTasks.set(task.id, task);
    this.elements.activeDownloadsCard.classList.add('active');
    
    this.renderTaskProgressRow(task.id, videoMeta.title, selectedOption.quality, selectedOption.size);

    this.notify(`Started downloading ${selectedOption.quality} (${selectedOption.size})...`, 'info');
    task.start();
  }

  renderTaskProgressRow(taskId, title, quality, totalMBStr) {
    const row = document.createElement('div');
    row.id = `task-row-${taskId}`;
    row.className = 'progress-item';

    row.innerHTML = `
      <div class="progress-header" style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <span class="progress-file-title" title="${escapeHtml(title)}">${escapeHtml(title)} [${quality}]</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="status-badge-${taskId}" class="progress-status-badge">0%</span>
          <button id="cancel-btn-${taskId}" class="cancel-download-btn" title="Cancel Download Process">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      </div>
      <div class="progress-bar-track">
        <div id="fill-${taskId}" class="progress-bar-fill"></div>
      </div>
      <div class="progress-details-footer">
        <span id="speed-${taskId}">Preparing stream...</span>
        <span id="size-eta-${taskId}"><strong>0.0 MB</strong> of <strong>${totalMBStr}</strong> completed</span>
      </div>
    `;

    const cancelBtn = row.querySelector(`#cancel-btn-${taskId}`);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const task = this.activeTasks.get(taskId);
        if (task) {
          task.cancel();
          this.activeTasks.delete(taskId);
          this.updateActiveTasksLabel();
          this.notify('Download process cancelled', 'info');
        }
      });
    }

    this.elements.activeProgressContainer.prepend(row);
    this.updateActiveTasksLabel();
  }

  onTaskProgress(data) {
    const fillEl = document.getElementById(`fill-${data.taskId}`);
    const badgeEl = document.getElementById(`status-badge-${data.taskId}`);
    const speedEl = document.getElementById(`speed-${data.taskId}`);
    const sizeEtaEl = document.getElementById(`size-eta-${data.taskId}`);
    const cancelBtn = document.getElementById(`cancel-btn-${data.taskId}`);

    if (data.status === 'cancelled') {
      if (fillEl) {
        fillEl.style.width = '0%';
        fillEl.style.background = 'var(--text-muted)';
        fillEl.style.boxShadow = 'none';
      }
      if (badgeEl) {
        badgeEl.textContent = '🛑 Cancelled';
        badgeEl.style.color = '#ff9900';
      }
      if (speedEl) {
        speedEl.textContent = '🛑 Download process cancelled by user';
        speedEl.style.color = 'var(--text-muted)';
      }
      if (sizeEtaEl) {
        sizeEtaEl.textContent = 'Cancelled';
      }
      if (cancelBtn) cancelBtn.remove();
      return;
    }

    if (data.status === 'error') {
      if (fillEl) {
        fillEl.style.width = '100%';
        fillEl.style.background = 'var(--color-error)';
      }
      if (badgeEl) {
        badgeEl.textContent = '❌ Failed';
        badgeEl.style.color = 'var(--color-error)';
      }
      if (speedEl) {
        speedEl.textContent = `❌ ${data.errorMsg || 'Download failed'}`;
        speedEl.style.color = 'var(--color-error)';
      }
      if (sizeEtaEl) {
        sizeEtaEl.textContent = 'Error during stream download processing';
      }
      if (cancelBtn) cancelBtn.remove();
      return;
    }

    if (data.status === 'preparing') {
      if (fillEl) {
        fillEl.style.width = '0%';
      }
      if (badgeEl) {
        badgeEl.textContent = '⏳ Preparing';
        badgeEl.style.color = 'var(--accent-solid)';
      }
      if (speedEl) {
        speedEl.textContent = data.speed;
        speedEl.style.color = 'var(--text-secondary)';
      }
      if (sizeEtaEl) {
        sizeEtaEl.innerHTML = `<strong>0.0 MB</strong> of <strong>${data.totalMB} MB</strong> (Server extracting stream...)`;
      }
      return;
    }

    if (fillEl) fillEl.style.width = `${data.percent}%`;
    if (badgeEl) badgeEl.textContent = `${data.percent}%`;
    if (speedEl) {
      speedEl.textContent = data.speed.startsWith('⚡') ? data.speed : `⚡ ${data.speed}`;
      speedEl.style.color = 'var(--text-secondary)';
    }
    if (sizeEtaEl) {
      const etaStr = (data.etaSec && data.etaSec !== '...') ? ` • ETA ${data.etaSec}s` : '';
      sizeEtaEl.innerHTML = `<strong style="color: var(--text-primary); font-weight:700;">${data.downloadedMB} MB</strong> of <strong>${data.totalMB} MB</strong> completed (${data.percent}%)${etaStr}`;
    }
  }

  onTaskComplete(historyEntry, filename) {
    this.notify(`Download complete! Saved ${filename}`, 'success');
    this.updateHistoryUI();

    const taskRow = document.querySelector('.progress-item');
    if (taskRow) {
      const cancelBtn = taskRow.querySelector('.cancel-download-btn');
      if (cancelBtn) cancelBtn.remove();
      const badgeEl = taskRow.querySelector('.progress-status-badge');
      if (badgeEl) {
        badgeEl.textContent = '✓ Completed';
        badgeEl.style.color = 'var(--color-success)';
      }
      const footerEl = taskRow.querySelector('.progress-details-footer');
      if (footerEl) {
        footerEl.innerHTML = `
          <span style="color: var(--color-success); font-weight: 600;">✓ Saved to Downloads</span>
          <span style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(filename)}</span>
        `;
      }
    }
  }

  updateActiveTasksLabel() {
    const count = this.activeTasks.size;
    this.elements.activeCountLabel.textContent = `${count} download${count > 1 ? 's' : ''} in progress`;
  }

  /* ==========================================
     DOWNLOADS HISTORY TAB RENDER
     ========================================== */
  updateHistoryUI() {
    const searchQuery = this.elements.historySearch ? this.elements.historySearch.value : '';
    const formatFilter = this.elements.historyFormatFilter ? this.elements.historyFormatFilter.value : 'all';

    const items = Storage.searchHistory(searchQuery, formatFilter);
    const allHistory = Storage.getHistory();

    if (this.elements.historyBadgeCount) {
      this.elements.historyBadgeCount.textContent = allHistory.length;
    }

    let totalBytes = 0;
    allHistory.forEach(item => {
      const numMB = parseFloat(item.size);
      if (!isNaN(numMB)) totalBytes += numMB;
    });

    if (this.elements.statTotalCount) this.elements.statTotalCount.textContent = allHistory.length;
    if (this.elements.statTotalSize) this.elements.statTotalSize.textContent = totalBytes.toFixed(1) + ' MB';

    if (!this.elements.historyListContainer) return;
    this.elements.historyListContainer.innerHTML = '';

    if (items.length === 0) {
      this.elements.emptyHistoryState.style.display = 'block';
    } else {
      this.elements.emptyHistoryState.style.display = 'none';

      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-item-card';

        const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        card.innerHTML = `
          <img class="history-thumb" src="${item.thumbnail}" alt="Thumbnail">
          <div class="history-info">
            <h4 class="history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
            <div class="history-meta">
              <span style="color: var(--accent-solid); font-weight: 700;">${item.platform}</span>
              <span>Quality: <strong>${item.quality}</strong> (${item.size})</span>
              <span>Saved on: ${dateStr}</span>
            </div>
          </div>
          <div class="history-actions">
            <button class="dl-button redownload-btn" title="1-Click Instant Download Processed File" style="padding: 0.4rem 0.85rem; font-size: 0.82rem; gap: 0.4rem; white-space: nowrap;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              <span>Download</span>
            </button>
            <button class="btn-icon-action copy-link-btn" title="Copy original video link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </button>
            <button class="btn-icon-action delete-history-btn" title="Delete from history" style="color: var(--color-error);">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        `;

        const redownloadBtn = card.querySelector('.redownload-btn');
        redownloadBtn.addEventListener('click', () => {
          const videoMeta = {
            url: item.url,
            title: item.title,
            author: item.author || 'Creator',
            durationStr: item.duration || '00:00',
            thumbnail: item.thumbnail,
            platform: { name: item.platform || 'YouTube', id: item.platformId || 'youtube', badgeClass: 'badge-youtube' }
          };

          const selectedOption = {
            quality: item.quality || '1080p',
            format: item.format || (item.quality === 'MP3' ? 'MP3' : 'MP4'),
            size: item.size || '15 MB',
            bytes: parseFloat(item.size || '15') * 1024 * 1024
          };

          this.notify(`⚡ 1-Click Download: Saving ${item.quality} file...`, 'info');
          this.triggerDownload(videoMeta, selectedOption);
        });

        const copyLinkBtn = card.querySelector('.copy-link-btn');
        copyLinkBtn.addEventListener('click', async () => {
          const success = await Clipboard.copyText(item.url);
          if (success) this.notify('Video URL copied to clipboard!', 'success');
        });

        const deleteBtn = card.querySelector('.delete-history-btn');
        deleteBtn.addEventListener('click', () => {
          Storage.deleteHistoryItem(item.id);
          this.updateHistoryUI();
          this.notify('Removed item from history', 'info');
        });

        this.elements.historyListContainer.appendChild(card);
      });
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new LinkVideoApp();
});
