/**
 * Storage Module - LocalStorage management for History and Settings
 */

const HISTORY_KEY = 'linkvideo_downloads_history';
const SETTINGS_KEY = 'linkvideo_user_settings';

const DEFAULT_SETTINGS = {
  defaultQuality: '720p',
  autoPaste: false,
  theme: 'dark',
  notifications: true,
  downloadSpeed: 'normal' // fast, normal, realistic
};

export const Storage = {
  /**
   * Get all download history items
   * @returns {Array} Array of history objects
   */
  getHistory() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse history from localStorage', e);
      return [];
    }
  },

  /**
   * Add a completed download to history
   * @param {Object} item Download item details
   */
  addHistoryItem(item) {
    const history = this.getHistory();
    const newItem = {
      id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      ...item
    };
    // Prepend to show newest first
    history.unshift(newItem);
    // Keep max 100 items to prevent storage explosion
    if (history.length > 100) history.pop();
    
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history item', e);
    }
    return newItem;
  },

  /**
   * Delete an item from history by ID
   * @param {string} id 
   */
  deleteHistoryItem(id) {
    let history = this.getHistory();
    history = history.filter(item => item.id !== id);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to delete history item', e);
    }
    return history;
  },

  /**
   * Clear all download history
   */
  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.error('Failed to clear history', e);
    }
    return [];
  },

  /**
   * Search history items by query string
   * @param {string} query 
   * @param {string} filterFormat 
   */
  searchHistory(query = '', filterFormat = 'all') {
    let history = this.getHistory();
    const q = query.trim().toLowerCase();

    return history.filter(item => {
      const matchesQuery = !q || 
        item.title.toLowerCase().includes(q) || 
        item.platform.toLowerCase().includes(q) ||
        (item.author && item.author.toLowerCase().includes(q));

      const matchesFormat = filterFormat === 'all' || 
        (filterFormat === 'mp3' ? item.quality.toLowerCase().includes('mp3') || item.quality.toLowerCase().includes('audio') : item.quality === filterFormat);

      return matchesQuery && matchesFormat;
    });
  },

  /**
   * Get user settings
   * @returns {Object} Settings object
   */
  getSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('Failed to parse settings from localStorage', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Save user settings
   * @param {Object} newSettings 
   */
  saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
    return updated;
  }
};
