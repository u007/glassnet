/**
 * Dashboard component for real-time network monitoring
 */

class Dashboard {
  constructor() {
    this.connections = [];
    this.filters = {
      protocol: '',
      process: '',
      state: '',
      port: '',
      portRange: ''
    };
    this.columnWidths = this.loadColumnWidths();
    this.popularPorts = {
      'Web Servers': [80, 443, 8080, 8443, 3000, 8000],
      'SSH/Remote': [22, 3389, 5900, 5901],
      'Email': [25, 110, 143, 993, 995, 587],
      'DNS': [53],
      'Database': [3306, 5432, 1433, 27017, 6379],
      'File Transfer': [21, 22, 69, 115, 990, 989],
      'VPN': [1194, 1723, 500, 4500],
      'Gaming': [27015, 7777, 25565, 26000]
    };
    this.init();
  }

  /**
   * Initialize dashboard
   */
  init() {
    this.setupEventListeners();
    this.loadInitialData();
    this.setupWebSocketListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Filter controls
    document.getElementById('protocolFilter').addEventListener('change', (e) => {
      this.filters.protocol = e.target.value;
      this.applyFilters();
    });

    document.getElementById('processFilter').addEventListener('change', (e) => {
      this.filters.process = e.target.value;
      this.applyFilters();
    });

    document.getElementById('stateFilter').addEventListener('change', (e) => {
      this.filters.state = e.target.value;
      this.applyFilters();
    });

    // Port filter controls
    document.getElementById('portFilter').addEventListener('input', (e) => {
      this.filters.port = e.target.value;
      this.validatePortFilter(e.target);
      this.applyFilters();
    });

    document.getElementById('portRangeFilter').addEventListener('change', (e) => {
      this.filters.portRange = e.target.value;
      if (e.target.value) {
        document.getElementById('portFilter').value = '';
        this.filters.port = '';
      }
      this.applyFilters();
    });

    document.getElementById('popularPortsFilter').addEventListener('change', (e) => {
      this.filters.portRange = e.target.value;
      if (e.target.value) {
        document.getElementById('portFilter').value = '';
        document.getElementById('portRangeFilter').value = '';
        this.filters.port = '';
      }
      this.applyFilters();
    });

    // Clear port filters button
    document.getElementById('clearPortFilters').addEventListener('click', () => {
      document.getElementById('portFilter').value = '';
      document.getElementById('portRangeFilter').value = '';
      document.getElementById('popularPortsFilter').value = '';
      this.filters.port = '';
      this.filters.portRange = '';
      this.applyFilters();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadInitialData();
    });

    // Column resizing
    this.setupColumnResizing();
  }

  /**
   * Setup WebSocket listeners
   */
  setupWebSocketListeners() {
    window.wsClient.on('connections', (newConnections) => {
      this.addNewConnections(newConnections);
    });

    window.wsClient.on('status', (status) => {
      this.updateMonitoringStatus(status);
    });

    window.wsClient.on('connected', () => {
      this.loadInitialData();
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      // Load statistics
      await this.loadStatistics();
      
      // Load recent connections
      await this.loadConnections();
      
      // Load process list for filter
      await this.loadProcessList();

      // Setup tooltips and UI enhancements
      this.setupTooltips();
      
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showToast('Failed to load data', 'error');
    }
  }

  /**
   * Load statistics
   */
  async loadStatistics() {
    try {
      const response = await fetch('/api/stats');
      const stats = await response.json();

      document.getElementById('totalConnections').textContent = 
        this.formatNumber(stats.totalConnections || 0);
      document.getElementById('connectionsToday').textContent = 
        this.formatNumber(stats.connectionsToday || 0);
      document.getElementById('activeProcesses').textContent = 
        this.formatNumber(stats.uniqueProcessesToday || 0);
      document.getElementById('dbSize').textContent = 
        this.formatFileSize(stats.databaseSize || 0);

    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  /**
   * Load connections
   */
  async loadConnections() {
    try {
      const params = new URLSearchParams({
        limit: '100',
        ...this.filters
      });

      const response = await fetch(`/api/connections?${params}`);
      const data = await response.json();

      this.connections = data.connections || [];
      this.renderConnections();

    } catch (error) {
      console.error('Error loading connections:', error);
      this.showConnectionsError();
    }
  }

  /**
   * Load process list for filters
   */
  async loadProcessList() {
    try {
      const response = await fetch('/api/processes');
      const data = await response.json();

      const processFilter = document.getElementById('processFilter');
      
      // Clear existing options except first one
      while (processFilter.children.length > 1) {
        processFilter.removeChild(processFilter.lastChild);
      }

      // Add process options
      for (const process of data.processes || []) {
        const option = document.createElement('option');
        option.value = process.process_name;
        option.textContent = `${process.process_name} (${process.count})`;
        processFilter.appendChild(option);
      }

    } catch (error) {
      console.error('Error loading process list:', error);
    }
  }

  /**
   * Add new connections from WebSocket
   */
  addNewConnections(newConnections) {
    if (!Array.isArray(newConnections)) return;

    // Mark new connections with a timestamp for sorting
    const now = Date.now();
    newConnections.forEach(conn => {
      conn.isNew = true;
      conn.addedAt = now;
    });

    // Add to beginning of list (newest first)
    this.connections.unshift(...newConnections);

    // Sort connections: new ones first, then by timestamp descending
    this.connections.sort((a, b) => {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      if (a.isNew && b.isNew) return b.addedAt - a.addedAt;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Keep only last 500 connections for performance
    if (this.connections.length > 500) {
      this.connections = this.connections.slice(0, 500);
    }

    this.renderConnections();
    
    // Update statistics
    this.loadStatistics();

    // Show notification for significant connections
    if (newConnections.length > 0) {
      this.showNewConnectionNotification(newConnections);
    }

    // Remove "new" flag after 30 seconds
    setTimeout(() => {
      newConnections.forEach(conn => {
        conn.isNew = false;
      });
      this.renderConnections();
    }, 30000);
  }

  /**
   * Apply filters to connections
   */
  applyFilters() {
    this.renderConnections();
    this.updateFilterStatus();
  }

  /**
   * Get filtered connections
   */
  getFilteredConnections() {
    return this.connections.filter(conn => {
      if (this.filters.protocol && conn.protocol !== this.filters.protocol) {
        return false;
      }
      if (this.filters.process && conn.process_name !== this.filters.process) {
        return false;
      }
      if (this.filters.state && conn.state !== this.filters.state) {
        return false;
      }
      
      // Port filtering
      if (this.filters.port) {
        const portFilter = this.filters.port.trim();
        const localPort = conn.local_port;
        const remotePort = conn.remote_port;
        
        if (portFilter.includes('-')) {
          // Port range (e.g., "80-443")
          const [start, end] = portFilter.split('-').map(p => parseInt(p.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            const matchesLocal = localPort >= start && localPort <= end;
            const matchesRemote = remotePort >= start && remotePort <= end;
            if (!matchesLocal && !matchesRemote) return false;
          }
        } else if (portFilter.includes(',')) {
          // Multiple ports (e.g., "80,443,8080")
          const ports = portFilter.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
          const matchesLocal = ports.includes(localPort);
          const matchesRemote = ports.includes(remotePort);
          if (!matchesLocal && !matchesRemote) return false;
        } else {
          // Single port
          const port = parseInt(portFilter);
          if (!isNaN(port)) {
            if (localPort !== port && remotePort !== port) return false;
          }
        }
      }
      
      // Port range filter (predefined ranges)
      if (this.filters.portRange) {
        const localPort = conn.local_port;
        const remotePort = conn.remote_port;
        let inRange = false;
        
        if (this.filters.portRange.startsWith('popular:')) {
          const category = this.filters.portRange.split(':')[1];
          const ports = this.popularPorts[category] || [];
          inRange = ports.includes(localPort) || ports.includes(remotePort);
        } else if (this.filters.portRange.includes('-')) {
          const [start, end] = this.filters.portRange.split('-').map(p => parseInt(p));
          inRange = (localPort >= start && localPort <= end) || (remotePort >= start && remotePort <= end);
        }
        
        if (!inRange) return false;
      }
      
      return true;
    });
  }

  /**
   * Render connections table
   */
  renderConnections() {
    const tbody = document.getElementById('connectionsBody');
    const filteredConnections = this.getFilteredConnections();

    // Update filter results counter
    this.updateResultsCounter(filteredConnections.length);

    if (filteredConnections.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty">
            ${this.connections.length === 0 ? 'No connections found' : 'No connections match the current filters'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredConnections.map(conn => `
      <tr class="${conn.isNew ? 'new-connection' : ''}">
        <td>${this.formatTime(conn.timestamp)}</td>
        <td title="${conn.process_name || 'Unknown'}">${this.truncateText(conn.process_name || 'Unknown', 20)}</td>
        <td>${conn.user_name || 'Unknown'}</td>
        <td><span class="protocol-${conn.protocol}">${conn.protocol.toUpperCase()}</span></td>
        <td>${this.formatAddress(conn.local_address, conn.local_port)}</td>
        <td title="${this.getRemoteAddressTooltip(conn)}">
          ${this.formatRemoteAddress(conn)}
        </td>
        <td><span class="state-${conn.state?.toLowerCase().replace(/[_\s]/g, '_')}">${conn.state || 'UNKNOWN'}</span></td>
      </tr>
    `).join('');

    // Apply saved column widths
    this.applyColumnWidths();
  }

  /**
   * Show connections loading error
   */
  showConnectionsError() {
    const tbody = document.getElementById('connectionsBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="loading">
          Failed to load connections. <button onclick="dashboard.loadConnections()" class="btn btn-primary">Retry</button>
        </td>
      </tr>
    `;
  }

  /**
   * Update monitoring status
   */
  updateMonitoringStatus(status) {
    // Update any monitoring status indicators if needed
    console.log('Monitoring status:', status);
  }

  /**
   * Show notification for new connections
   */
  showNewConnectionNotification(connections) {
    if (connections.length === 1) {
      const conn = connections[0];
      this.showToast(
        `New connection: ${conn.process_name} → ${conn.remote_address}:${conn.remote_port}`,
        'info'
      );
    } else if (connections.length > 1) {
      this.showToast(`${connections.length} new connections detected`, 'info');
    }
  }

  /**
   * Format time for display
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  /**
   * Format address and port
   */
  formatAddress(address, port) {
    if (!address || address === '*') {
      return '*:*';
    }
    return `${address}:${port || 0}`;
  }

  /**
   * Format remote address with optional hostname
   */
  formatRemoteAddress(conn) {
    const address = conn.remote_address;
    const port = conn.remote_port;
    const hostname = conn.remote_hostname;

    if (!address || address === '*') {
      return '*:*';
    }

    // If we have a hostname and it's different from the IP, show hostname
    if (hostname && hostname !== address) {
      return `${hostname}:${port || 0}`;
    }

    // Otherwise just show IP:port
    return `${address}:${port || 0}`;
  }

  /**
   * Get tooltip text for remote address
   */
  getRemoteAddressTooltip(conn) {
    const address = conn.remote_address;
    const port = conn.remote_port;
    const hostname = conn.remote_hostname;

    if (!address || address === '*') {
      return '*:*';
    }

    // If we have both hostname and IP, show both in tooltip
    if (hostname && hostname !== address) {
      return `${hostname} (${address}:${port || 0})`;
    }

    // Otherwise just show IP:port
    return `${address}:${port || 0}`;
  }

  /**
   * Truncate text with ellipsis
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Format numbers with thousands separators
   */
  formatNumber(num) {
    return new Intl.NumberFormat().format(num);
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
   * Setup column resizing
   */
  setupColumnResizing() {
    const table = document.getElementById('connectionsTable');
    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
      header.style.position = 'relative';
      header.style.minWidth = '100px';
      
      // Create resize handle
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.position = 'absolute';
      resizeHandle.style.top = '0';
      resizeHandle.style.right = '0';
      resizeHandle.style.width = '5px';
      resizeHandle.style.height = '100%';
      resizeHandle.style.cursor = 'col-resize';
      resizeHandle.style.backgroundColor = 'transparent';
      
      header.appendChild(resizeHandle);
      
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;
      
      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(header).width, 10);
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const width = startWidth + e.clientX - startX;
        const minWidth = 80;
        const maxWidth = 400;
        
        if (width >= minWidth && width <= maxWidth) {
          header.style.width = width + 'px';
          this.columnWidths[index] = width;
        }
      });
      
      document.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = '';
          this.saveColumnWidths();
        }
      });
    });
  }

  /**
   * Load column widths from localStorage
   */
  loadColumnWidths() {
    const saved = localStorage.getItem('glassnet-column-widths');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved column widths:', e);
      }
    }
    return {};
  }

  /**
   * Save column widths to localStorage
   */
  saveColumnWidths() {
    localStorage.setItem('glassnet-column-widths', JSON.stringify(this.columnWidths));
  }

  /**
   * Apply saved column widths
   */
  applyColumnWidths() {
    const table = document.getElementById('connectionsTable');
    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
      if (this.columnWidths[index]) {
        header.style.width = this.columnWidths[index] + 'px';
      }
    });
  }

  /**
   * Setup tooltips and UI enhancements
   */
  setupTooltips() {
    // Add tooltip for port filter
    const portFilter = document.getElementById('portFilter');
    if (portFilter) {
      portFilter.setAttribute('title', 
        'Examples:\n' +
        '• Single port: 80\n' +
        '• Port range: 80-443\n' +
        '• Multiple ports: 80,443,8080\n' +
        '• Mixed: 22,80-443,8080'
      );
    }

    // Update popular ports filter with port numbers
    const popularPortsFilter = document.getElementById('popularPortsFilter');
    if (popularPortsFilter) {
      const options = popularPortsFilter.querySelectorAll('option[value^="popular:"]');
      options.forEach(option => {
        const category = option.value.split(':')[1];
        const ports = this.popularPorts[category];
        if (ports) {
          option.textContent = `${category} (${ports.join(', ')})`;
        }
      });
    }
  }

  /**
   * Get active filter count for display
   */
  getActiveFilterCount() {
    let count = 0;
    if (this.filters.protocol) count++;
    if (this.filters.process) count++;
    if (this.filters.state) count++;
    if (this.filters.port) count++;
    if (this.filters.portRange) count++;
    return count;
  }

  /**
   * Update filter status display
   */
  updateFilterStatus() {
    const activeCount = this.getActiveFilterCount();
    const refreshBtn = document.getElementById('refreshBtn');
    
    if (activeCount > 0) {
      refreshBtn.textContent = `🔄 Refresh (${activeCount} filters)`;
      refreshBtn.classList.add('has-filters');
    } else {
      refreshBtn.textContent = '🔄 Refresh';
      refreshBtn.classList.remove('has-filters');
    }
  }

  /**
   * Validate port filter input
   */
  validatePortFilter(input) {
    const value = input.value.trim();
    let isValid = true;
    
    if (value) {
      if (value.includes('-')) {
        // Range validation
        const [start, end] = value.split('-').map(p => parseInt(p.trim()));
        isValid = !isNaN(start) && !isNaN(end) && start <= end && start >= 1 && end <= 65535;
      } else if (value.includes(',')) {
        // Multiple ports validation
        const ports = value.split(',').map(p => parseInt(p.trim()));
        isValid = ports.every(p => !isNaN(p) && p >= 1 && p <= 65535);
      } else {
        // Single port validation
        const port = parseInt(value);
        isValid = !isNaN(port) && port >= 1 && port <= 65535;
      }
    }
    
    if (isValid) {
      input.classList.remove('invalid');
      input.style.borderColor = '';
    } else {
      input.classList.add('invalid');
      input.style.borderColor = '#dc2626';
    }
    
    return isValid;
  }

  /**
   * Update results counter display
   */
  updateResultsCounter(count) {
    const tableContainer = document.querySelector('.table-container h2');
    if (tableContainer) {
      const total = this.connections.length;
      if (count === total) {
        tableContainer.textContent = `Live Network Connections (${total})`;
      } else {
        tableContainer.textContent = `Live Network Connections (${count} of ${total})`;
      }
    }
  }
}

// Initialize dashboard when DOM is loaded
let dashboard;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
  });
} else {
  dashboard = new Dashboard();
}
