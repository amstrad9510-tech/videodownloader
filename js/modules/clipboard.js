/**
 * Clipboard Helper Module
 */

import { isValidUrl } from './metadata.js';

export const Clipboard = {
  /**
   * Read text from system clipboard
   * @returns {Promise<string|null>}
   */
  async readText() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        return text ? text.trim() : null;
      }
    } catch (err) {
      console.warn('Clipboard read access denied or unavailable', err);
    }
    return null;
  },

  /**
   * Copy text to system clipboard
   * @param {string} text 
   * @returns {Promise<boolean>}
   */
  async copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('Clipboard write access failed', err);
    }

    // Fallback using document.execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (e) {
      return false;
    }
  },

  /**
   * Check if clipboard currently contains a valid video link
   */
  async getClipboardVideoUrl() {
    const text = await this.readText();
    if (text && isValidUrl(text)) {
      return text;
    }
    return null;
  }
};
