/**
 * LinkVideo Downloader - Metadata Engine
 * Live URL validation, platform detection, oEmbed fetching, duration & MB size calculator
 */

export const PLATFORMS = {
  YOUTUBE: {
    name: 'YouTube',
    id: 'youtube',
    badgeClass: 'badge-youtube',
    color: '#FF0000',
    iconSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
  }
};

export const SAMPLE_LINKS = [
  {
    label: '🎵 Music Video (4K)',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    label: '📱 YouTube Shorts (Viral)',
    platform: 'youtube',
    url: 'https://www.youtube.com/shorts/CABRnIbKrz4'
  },
  {
    label: '💻 Tech Review (1080p)',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=yGXpgB8Sdy0'
  },
  {
    label: '🎙️ Podcast & Audio',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=L_LUpnjgPso'
  }
];

const KNOWN_VIDEO_STATS = {
  'dQw4w9WgXcQ': {
    title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
    author: 'Rick Astley',
    durationSec: 213,
    durationStr: '03:33',
    viewsStr: '1.5B views'
  },
  'CABRnIbKrz4': {
    title: 'Satisfying 3D Animation Shorts 🔥 #shorts #viral',
    author: '@creative_3d',
    durationSec: 28,
    durationStr: '00:28',
    viewsStr: '2.4M views'
  },
  'yGXpgB8Sdy0': {
    title: 'Building a Real-Time Web Application Step by Step (Complete Guide)',
    author: 'Tech Academy',
    durationSec: 420,
    durationStr: '07:00',
    viewsStr: '620K views'
  },
  'L_LUpnjgPso': {
    title: 'Chill Lofi Beats to Relax & Study To 🎧 (24/7 Audio Stream)',
    author: 'Lofi Girl',
    durationSec: 3600,
    durationStr: '01:00:00',
    viewsStr: '5.8M views'
  }
};

export function isValidUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export function isYouTubeUrl(urlString) {
  if (!isValidUrl(urlString)) return false;
  const lower = urlString.toLowerCase();
  return lower.includes('youtube.com') || lower.includes('youtu.be');
}

export function detectPlatform(urlString) {
  return PLATFORMS.YOUTUBE;
}

export function formatDuration(seconds) {
  const sec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const mm = m < 10 ? '0' + m : m;
  const ss = s < 10 ? '0' + s : s;

  if (h > 0) {
    const hh = h < 10 ? '0' + h : h;
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function generateFormatOptions(durationSec = 180, liveFormatSizes = {}) {
  const ultraMB = (liveFormatSizes['2160p'] || liveFormatSizes['4k']) ? (liveFormatSizes['2160p'] || liveFormatSizes['4k']).toFixed(1) : Math.max(12.0, (durationSec * 14.0 / 8)).toFixed(1);
  const qhdMB = (liveFormatSizes['1440p'] || liveFormatSizes['2k']) ? (liveFormatSizes['1440p'] || liveFormatSizes['2k']).toFixed(1) : Math.max(7.0, (durationSec * 6.5 / 8)).toFixed(1);
  const fhdMB = liveFormatSizes['1080p'] ? liveFormatSizes['1080p'].toFixed(1) : Math.max(3.5, (durationSec * 2.8 / 8)).toFixed(1);
  const hdMB = liveFormatSizes['720p'] ? liveFormatSizes['720p'].toFixed(1) : Math.max(2.0, (durationSec * 1.5 / 8)).toFixed(1);
  const sdMB = liveFormatSizes['480p'] ? liveFormatSizes['480p'].toFixed(1) : Math.max(1.0, (durationSec * 0.7 / 8)).toFixed(1);
  const sd360MB = liveFormatSizes['360p'] ? liveFormatSizes['360p'].toFixed(1) : Math.max(0.6, (durationSec * 0.4 / 8)).toFixed(1);
  const mp3MB = Math.max(0.4, (durationSec * 0.16 / 8)).toFixed(1);

  return [
    {
      quality: '2160p',
      label: '4K Ultra HD (2160p)',
      format: 'MP4',
      mimeType: 'video/mp4',
      badge: '4K ULTRA',
      badgeClass: 'badge-4k',
      size: `${ultraMB} MB`,
      bytes: Math.round(parseFloat(ultraMB) * 1024 * 1024),
      fps: '60fps',
      bitrate: '14.0 Mbps'
    },
    {
      quality: '1440p',
      label: '2K Quad HD (1440p)',
      format: 'MP4',
      mimeType: 'video/mp4',
      badge: '2K QHD',
      badgeClass: 'badge-2k',
      size: `${qhdMB} MB`,
      bytes: Math.round(parseFloat(qhdMB) * 1024 * 1024),
      fps: '60fps',
      bitrate: '6.5 Mbps'
    },
    {
      quality: '1080p',
      label: '1080p Full HD Video',
      format: 'MP4',
      mimeType: 'video/mp4',
      badge: 'FHD',
      badgeClass: 'badge-fhd',
      size: `${fhdMB} MB`,
      bytes: Math.round(parseFloat(fhdMB) * 1024 * 1024),
      fps: '60fps',
      bitrate: '2.8 Mbps'
    },
    {
      quality: '720p',
      label: '720p HD Video',
      format: 'MP4',
      mimeType: 'video/mp4',
      badge: 'HD',
      badgeClass: 'badge-hd',
      size: `${hdMB} MB`,
      bytes: Math.round(parseFloat(hdMB) * 1024 * 1024),
      fps: '30fps',
      bitrate: '1.5 Mbps'
    },
    {
      quality: '480p',
      label: '480p SD Video',
      format: 'MP4',
      mimeType: 'video/mp4',
      badge: 'SD',
      badgeClass: 'badge-sd',
      size: `${sdMB} MB`,
      bytes: Math.round(parseFloat(sdMB) * 1024 * 1024),
      fps: '30fps',
      bitrate: '0.7 Mbps'
    },
    {
      quality: '360p',
      label: '360p SD Video',
      format: 'MP4',
      mimeType: 'video/mp4',
      badge: '360P',
      badgeClass: 'badge-sd',
      size: `${sd360MB} MB`,
      bytes: Math.round(parseFloat(sd360MB) * 1024 * 1024),
      fps: '30fps',
      bitrate: '0.4 Mbps'
    },
    {
      quality: 'MP3',
      label: 'Audio Only (MP3 320kbps)',
      format: 'MP3',
      mimeType: 'audio/mpeg',
      badge: 'MP3 AUDIO',
      badgeClass: 'badge-audio',
      size: `${mp3MB} MB`,
      bytes: Math.round(parseFloat(mp3MB) * 1024 * 1024),
      fps: 'N/A',
      bitrate: '320 kbps'
    }
  ];
}

/**
 * Fetch video metadata live from input link via oEmbed & URL metadata extractors
 * @param {string} url 
 * @returns {Promise<Object>} Metadata object
 */
export async function fetchVideoMetadata(url) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL format. Please enter a full http:// or https:// YouTube video link.');
  }

  if (!isYouTubeUrl(url)) {
    throw new Error('YouTube Downloader supports YouTube links only (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)');
  }

  const platform = detectPlatform(url);
  const cleanUrl = url.trim();

  let title = '';
  let author = '';
  let thumbnail = '';
  let durationSec = 180;
  let durationStr = '03:00';
  let viewsStr = 'HD Video Stream';
  let embedIframeUrl = '';
  let videoStreamUrl = '';
  let videoId = '';
  let formatSizes = {};

  // 1. Try Live Backend API /api/info
  try {
    const apiRes = await fetch(`/api/info?url=${encodeURIComponent(cleanUrl)}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && !data.error) {
        if (data.title) title = data.title;
        if (data.author) author = data.author;
        if (data.thumbnail) thumbnail = data.thumbnail;
        if (data.durationSec) durationSec = data.durationSec;
        if (data.durationStr) durationStr = data.durationStr;
        if (data.viewsStr) viewsStr = data.viewsStr;
        if (data.formatSizes) formatSizes = data.formatSizes;
        if (data.videoId) videoId = data.videoId;
        if (data.embedIframeUrl) embedIframeUrl = data.embedIframeUrl;
      }
    }
  } catch (e) {
    console.warn('Backend /api/info skipped or offline, using client fallback', e);
  }

  const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i) || cleanUrl.match(/([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1] && ytMatch[1].length === 11) {
    if (!videoId) videoId = ytMatch[1];
    if (!thumbnail) thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    if (!embedIframeUrl) embedIframeUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`;
  }

  // 2. oEmbed API query fallback if title missing
  if (!title) {
    try {
      let apiEndpoint = `https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`;
      if (platform.id === 'youtube') {
        apiEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
      }

      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.title) title = data.title;
          if (data.author_name) author = data.author_name;
          if (data.thumbnail_url && !thumbnail) thumbnail = data.thumbnail_url;
        }
      }
    } catch (e) {
      console.warn('oEmbed API fetch bypassed', e);
    }
  }

  // 3. Known stats map fallback
  if (videoId && KNOWN_VIDEO_STATS[videoId]) {
    const known = KNOWN_VIDEO_STATS[videoId];
    if (!title) title = known.title;
    if (!author) author = known.author;
    if (durationSec === 180) {
      durationSec = known.durationSec;
      durationStr = known.durationStr;
      viewsStr = known.viewsStr;
    }
  }

  if (!title) title = extractTitleFromUrl(cleanUrl, platform);
  if (!author) author = extractAuthorFromUrl(cleanUrl, platform);
  if (!thumbnail) thumbnail = createVisualThumbnailSvg(title, platform, durationStr);

  const options = generateFormatOptions(durationSec, formatSizes);

  return {
    url: cleanUrl,
    title,
    author,
    durationSec,
    durationStr,
    viewsStr,
    platform,
    poster: thumbnail,
    thumbnail,
    videoStreamUrl,
    embedIframeUrl,
    videoId,
    options
  };
}

function extractTitleFromUrl(urlStr, platform) {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname;
    
    if (platform.id === 'youtube') {
      const vParam = parsed.searchParams.get('v');
      if (vParam) return `YouTube Video [${vParam}]`;
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) return `YouTube Video [${parts[parts.length - 1]}]`;
    }

    if (platform.id === 'instagram') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return `Instagram Reel #${parts[1]}`;
    }

    if (platform.id === 'tiktok') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 3) return `${parts[0]} TikTok Video #${parts[2]}`;
    }

    const filename = pathname.split('/').pop();
    if (filename && filename.length > 3) {
      return decodeURIComponent(filename).replace(/[-_]/g, ' ');
    }
  } catch (e) {}

  return `${platform.name} Video Stream (${new Date().toLocaleDateString()})`;
}

function extractAuthorFromUrl(urlStr, platform) {
  try {
    const parsed = new URL(urlStr);
    if (platform.id === 'tiktok') {
      const user = parsed.pathname.split('/')[1];
      if (user && user.startsWith('@')) return user;
    }
  } catch (e) {}
  return `${platform.name} Creator`;
}

function createVisualThumbnailSvg(title, platformObj, durationStr) {
  const bgGradId = 'bg_' + Math.random().toString(36).substr(2, 6);
  let primaryColor = platformObj.color || '#6366F1';
  let secondaryColor = '#0F172A';

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%">
      <defs>
        <linearGradient id="${bgGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${secondaryColor}" />
          <stop offset="100%" stop-color="${primaryColor}" />
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#${bgGradId})" />
      <circle cx="1000" cy="150" r="300" fill="${primaryColor}" opacity="0.25" />
      <rect x="520" y="240" width="240" height="240" rx="40" fill="rgba(255, 255, 255, 0.15)" stroke="rgba(255, 255, 255, 0.3)" stroke-width="4"/>
      <polygon points="620,310 620,410 700,360" fill="#FFFFFF" />
      <text x="60" y="640" font-family="Inter, sans-serif" font-size="36" font-weight="700" fill="#FFFFFF">${escapeXml(title)}</text>
      <rect x="1100" y="620" width="120" height="50" rx="12" fill="rgba(0,0,0,0.8)" />
      <text x="1160" y="653" font-family="Inter, sans-serif" font-size="22" font-weight="600" fill="#FFFFFF" text-anchor="middle">${durationStr}</text>
    </svg>
  `;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
}

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
