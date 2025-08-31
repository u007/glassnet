/**
 * Settings component for configuration and database management
 */

class Settings {
  constructor() {
    this.config = {};
    this.stats = {};
    this.startTime = Date.now();
    this.init();
  }

  /**
   * Initialize settings component
   */
  init() {
    this.setupEventListeners();
    this.loadSettings();
    this.startUptimeTimer();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Cleanup buttons
    document.getElementById('cleanupOldBtn').addEventListener('click', () => {
      this.cleanupOldRecords();
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
      this.clearAllData();
    });

    // Also handle header clear logs button
    document.getElementById('clearLogsBtn').addEventListener('click', () => {
      this.clearAllData();
    });
  }

  /**
   * Load settings and configuration
   */
  async loadSettings() {
    try {
      // Load configuration
      const configResponse = await fetch('/api/config');
      this.config = await configResponse.json();

      // Load statistics
      const statsResponse = await fetch('/api/stats');
      this.stats = await statsResponse.json();

      this.renderSettings();

    } catch (error) {
      console.error('Error loading settings:', error);
      this.showError('Failed to load settings');
    }
  }

  /**
   * Render settings display
   */
  renderSettings() {
    // Monitoring settings
    document.getElementById('scanInterval').textContent = 
      `${this.config.monitoring?.interval || 5000}ms`;
    
    document.getElementById('monitoredProtocols').textContent = 
      (this.config.monitoring?.protocols || ['TCP', 'UDP']).join(', ').toUpperCase();
    
    document.getElementById('includeLoopback').textContent = 
      this.config.monitoring?.includeLoopback ? 'Yes' : 'No';

    // Database settings
    document.getElementById('retentionDays').textContent = 
      `${this.config.database?.retentionDays || 3} days`;

    document.getElementById('settingsDbSize').textContent = 
      this.formatFileSize(this.stats.databaseSize || 0);

    // System information
    document.getElementById('platform').textContent = 
      this.stats.monitoring?.platform || navigator.platform;

    document.getElementById('connectedClients').textContent = 
      this.stats.monitoring?.listeners || 0;
  }

  /**
   * Start uptime timer
   */
  startUptimeTimer() {
    const updateUptime = () => {
      const uptime = Date.now() - this.startTime;
      document.getElementById('serverUptime').textContent = this.formatUptime(uptime);
    };

    updateUptime();
    setInterval(updateUptime, 1000);
  }

  /**
   * Cleanup old records
   */
  async cleanupOldRecords() {
    if (!confirm('This will remove old connection records based on the retention policy. Continue?')) {
      return;
    }

    try {
      this.showLoading('Cleaning up old records...');

      const response = await fetch('/api/connections/cleanup', {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      this.showSuccess(`Successfully cleaned up ${result.deletedCount} old records`);
      
      // Refresh settings to show updated database size
      await this.loadSettings();

    } catch (error) {
      console.error('Error cleaning up records:', error);
      this.showError(`Failed to cleanup records: ${error.message}`);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    if (!confirm('This will permanently delete ALL connection records. This action cannot be undone. Continue?')) {
      return;
    }

    // Double confirmation for destructive action
    if (!confirm('Are you absolutely sure? This will delete everything!')) {
      return;
    }

    try {
      this.showLoading('Clearing all data...');

      const response = await fetch('/api/connections/cleanup?action=all', {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      this.showSuccess(`Successfully cleared ${result.deletedCount} records`);
      
      // Refresh settings and dashboard
      await this.loadSettings();
      
      // Refresh dashboard if it exists
      if (window.dashboard) {
        window.dashboard.loadInitialData();
      }

    } catch (error) {
      console.error('Error clearing data:', error);
      this.showError(`Failed to clear data: ${error.message}`);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Show loading overlay
   */
  showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    
    text.textContent = message;
    overlay.classList.add('show');
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('show');
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div>${message}</div>
    `;

    container.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format uptime duration
   */
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Export configuration
   */
  exportConfig() {
    const configData = {
      ...this.config,
      exportedAt: new Date().toISOString(),
      stats: this.stats
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], { 
      type: 'application/json;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `glassnet-config-${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  /**
   * Refresh settings
   */
  async refresh() {
    await this.loadSettings();
    this.showSuccess('Settings refreshed');
  }
}

// Initialize settings when DOM is loaded
let settingsComponent;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    settingsComponent = new Settings();
  });
} else {
  settingsComponent = new Settings();
}
