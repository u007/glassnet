/**
 * Main application controller
 */

class GlassNetApp {
  constructor() {
    this.currentTab = 'dashboard';
    this.currentMode = 'simple'; // Default to simple mode
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupTabNavigation();
    this.setupModeToggle();
    this.setupGlobalEventListeners();
    this.showInitialTab();
    this.applyCurrentMode();
    
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

  setupModeToggle() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    modeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-mode');
        this.switchMode(mode);
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

  switchMode(mode) {
    if (this.currentMode === mode) return;

    this.currentMode = mode;
    
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    // Apply mode changes
    this.applyCurrentMode();

    // Save mode preference
    localStorage.setItem('glassnet-mode', mode);
  }

  applyCurrentMode() {
    const isSimpleMode = this.currentMode === 'simple';
    
    // Show/hide filter sections
    const expertFilters = document.getElementById('expertFilters');
    const simpleModeInfo = document.getElementById('simpleModeInfo');
    const expertTable = document.getElementById('expertTable');
    const simpleTable = document.getElementById('simpleTable');

    if (expertFilters) {
      expertFilters.style.display = isSimpleMode ? 'none' : 'block';
    }
    
    if (simpleModeInfo) {
      simpleModeInfo.style.display = isSimpleMode ? 'block' : 'none';
    }
    
    if (expertTable) {
      expertTable.style.display = isSimpleMode ? 'none' : 'table';
    }
    
    if (simpleTable) {
      simpleTable.style.display = isSimpleMode ? 'table' : 'none';
    }

    // Notify dashboard component about mode change (with delay to ensure it's ready)
    setTimeout(() => {
      if (window.dashboard && typeof window.dashboard.onModeChange === 'function') {
        window.dashboard.onModeChange(this.currentMode);
      }
    }, 100);
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
    const savedMode = localStorage.getItem('glassnet-mode') || 'simple';
    
    this.currentMode = savedMode;
    this.switchTab(initialTab);
    
    // Update mode button to reflect saved mode
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${savedMode}"]`).classList.add('active');
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
  showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const notification = document.createElement('div');
    notification.className = `toast ${type}`;
    notification.innerHTML = `
      <div class="toast-content">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
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
