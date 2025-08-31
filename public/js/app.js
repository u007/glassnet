/**
 * Main application controller
 */

class GlassNetApp {
  constructor() {
    this.currentTab = 'dashboard';
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupTabNavigation();
    this.setupGlobalEventListeners();
    this.showInitialTab();
    
    console.log('🔍 GlassNet application initialized');
  }

  /**
   * Setup tab navigation
   */
  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.target.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });
  }

  /**
   * Setup global event listeners
   */
  setupGlobalEventListeners() {
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // Handle window visibility changes
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Handle window beforeunload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Handle WebSocket connection events
    window.wsClient.on('connected', () => {
      console.log('Application: WebSocket connected');
    });

    window.wsClient.on('disconnected', () => {
      console.log('Application: WebSocket disconnected');
    });

    window.wsClient.on('error', (error) => {
      console.error('Application: WebSocket error:', error);
    });
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    if (this.currentTab === tabName) return;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');

    this.currentTab = tabName;

    // Handle tab-specific actions
    this.onTabSwitch(tabName);
  }

  /**
   * Handle tab switch events
   */
  onTabSwitch(tabName) {
    switch (tabName) {
      case 'dashboard':
        // Refresh dashboard data if needed
        if (window.dashboard) {
          window.dashboard.loadStatistics();
        }
        break;
        
      case 'history':
        // Load process list for history filters
        if (window.historyComponent) {
          window.historyComponent.loadProcessList();
        }
        break;
        
      case 'settings':
        // Refresh settings
        if (window.settingsComponent) {
          window.settingsComponent.loadSettings();
        }
        break;
    }
  }

  /**
   * Show initial tab
   */
  showInitialTab() {
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'dashboard';
    this.switchTab(initialTab);
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(e) {
    // Only handle shortcuts when not typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    // Handle shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          this.switchTab('dashboard');
          break;
        case '2':
          e.preventDefault();
          this.switchTab('history');
          break;
        case '3':
          e.preventDefault();
          this.switchTab('settings');
          break;
        case 'r':
          e.preventDefault();
          this.refreshCurrentTab();
          break;
      }
    }

    // Handle other shortcuts
    switch (e.key) {
      case 'F5':
        e.preventDefault();
        this.refreshCurrentTab();
        break;
    }
  }

  /**
   * Refresh current tab
   */
  refreshCurrentTab() {
    switch (this.currentTab) {
      case 'dashboard':
        if (window.dashboard) {
          window.dashboard.loadInitialData();
        }
        break;
      case 'history':
        if (window.historyComponent) {
          window.historyComponent.loadHistory();
        }
        break;
      case 'settings':
        if (window.settingsComponent) {
          window.settingsComponent.refresh();
        }
        break;
    }
  }

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange() {
    if (document.hidden) {
      console.log('Application: Page hidden');
      // Reduce update frequency when page is hidden
    } else {
      console.log('Application: Page visible');
      // Resume normal updates and refresh current tab
      this.refreshCurrentTab();
    }
  }

  /**
   * Cleanup before page unload
   */
  cleanup() {
    console.log('Application: Cleaning up...');
    
    // Close WebSocket connection
    if (window.wsClient) {
      window.wsClient.close();
    }
  }

  /**
   * Show global notification
   */
  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    const notification = document.createElement('div');
    notification.className = `toast ${type}`;
    notification.innerHTML = `
      <div>${message}</div>
    `;

    container.appendChild(notification);

    // Auto-remove notification
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);

    return notification;
  }

  /**
   * Show confirmation dialog
   */
  confirm(message, callback) {
    if (window.confirm(message)) {
      if (typeof callback === 'function') {
        callback();
      }
      return true;
    }
    return false;
  }

  /**
   * Format time relative to now
   */
  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  /**
   * Get current application state
   */
  getState() {
    return {
      currentTab: this.currentTab,
      connected: window.wsClient?.isConnected() || false,
      timestamp: Date.now()
    };
  }

  /**
   * Update URL with current tab (for bookmarking)
   */
  updateURL() {
    const url = new URL(window.location);
    url.searchParams.set('tab', this.currentTab);
    window.history.replaceState({}, '', url);
  }
}

// Initialize the application when DOM is ready
let app;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app = new GlassNetApp();
  });
} else {
  app = new GlassNetApp();
}

// Make app globally available
window.glassNetApp = app;
