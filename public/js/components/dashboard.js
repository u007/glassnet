/**
 * Dashboard component for real-time network monitoring
 */

class Dashboard {
  constructor() {
    this.instanceId = Math.random().toString(36).substring(2, 8);
    console.log(`Dashboard instance created: ${this.instanceId}`);

    this.connectionsBody = document.getElementById('connectionsBody');
    this.simpleConnectionsBody = document.getElementById('simpleConnectionsBody');
    this.autoRefreshToggle = document.getElementById('autoRefreshToggle');
    this.lastRefreshInfo = document.getElementById('lastRefreshInfo');
    this.nextRefreshInfo = document.getElementById('nextRefreshInfo');
    this.simpleLastRefresh = document.getElementById('simpleLastRefresh');
    
    // Get current mode from app or localStorage
    this.currentMode = localStorage.getItem('glassnet-mode') || 'simple';
    
    this.filters = {
      protocol: '',
      process: '',
      state: '',
      port: '',
      portRange: ''
    };
    this.columnWidths = this.loadColumnWidths();
    this.expandedConnections = this.loadExpandedConnections(); // Load from localStorage
    
    // Auto-refresh properties
    // Auto-refresh simple state
  this.autoRefresh = {
      enabled: localStorage.getItem('glassnet-auto-refresh-enabled') === 'true',
      interval: parseInt(localStorage.getItem('glassnet-auto-refresh-interval') || '10'),
      timer: null
    };
  this.lastRefresh = null;
  this.nextRefreshAt = null;
  this.metaTimer = null;
    
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
    
    // Auto-refresh toggle initialization
    if (this.autoRefreshToggle) {
      this.autoRefreshToggle.checked = this.autoRefresh.enabled;
      this.autoRefreshToggle.addEventListener('change', (e) => {
        this.setAutoRefreshEnabled(e.target.checked);
      });
    }

    if (this.autoRefresh.enabled) {
        this.scheduleAutoRefresh();
    } else {
        this.updateRefreshMeta();
    }
  }

  /**
   * Handle mode change (simple/expert)
   */
  onModeChange(mode) {
    // Apply column widths when switching to ensure proper sizing
    setTimeout(() => {
      this.applyColumnWidths();
    }, 50); // Small delay to ensure DOM is ready
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Simple mode refresh button
    const simpleRefreshBtn = document.getElementById('simpleRefreshBtn');
    if (simpleRefreshBtn) {
      simpleRefreshBtn.addEventListener('click', () => {
        this.loadSimpleConnections();
      });
    }

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

    // Auto-refresh controls
    document.getElementById('autoRefreshToggle').addEventListener('click', () => {
      this.setAutoRefreshEnabled(!this.autoRefresh.enabled);
    });

    document.getElementById('refreshInterval').addEventListener('change', (e) => {
      this.autoRefresh.interval = parseInt(e.target.value);
      localStorage.setItem('glassnet-auto-refresh-interval', this.autoRefresh.interval.toString());
      if (this.autoRefresh.enabled) this.scheduleAutoRefresh(true);
      this.updateRefreshButtonText();
    });

    // Cleanup auto-refresh on page unload
    window.addEventListener('beforeunload', () => {
      this.clearAutoRefreshTimer();
    });

    // Column resizing
    this.setupColumnResizing();
  }

  /**
   * Setup WebSocket listeners
   */
  setupWebSocketListeners() {
    window.wsClient.on('connections', (newConnections) => {
      // Only update connections if auto-refresh is enabled
      if (this.autoRefresh.enabled) {
        this.addNewConnections(newConnections);
      }
    });

    window.wsClient.on('status', (status) => {
      this.updateMonitoringStatus(status);
    });

    window.wsClient.on('connected', () => {
      this.loadInitialData();
    });
  }

  onModeChange(mode) {
    this.currentMode = mode;
    if (mode === 'simple') {
      this.loadSimpleConnections();
    } else {
      this.loadConnections();
    }
  }

  async loadSimpleConnections() {
    try {
      const response = await fetch('/api/connections?limit=100');
      const data = await response.json();

      this.connections = data.connections || [];
      this.renderSimpleConnections();
      
      // Update last refresh time
      this.lastRefresh = Date.now();
      if (this.simpleLastRefresh) {
        const timeSince = Date.now() - this.lastRefresh;
        this.simpleLastRefresh.textContent = 'Last: ' + this.formatDuration(timeSince);
        this.simpleLastRefresh.title = 'Last refresh: ' + new Date(this.lastRefresh).toLocaleString();
      }
      
    } catch (error) {
      console.error('Error loading simple connections:', error);
      this.showSimpleConnectionsError();
    }
  }

  renderSimpleConnections() {
    const tbody = this.simpleConnectionsBody;
    if (!tbody) return;

    // Filter out connections without process ID and get unique process-remote combinations
    const simpleConnections = this.getSimpleConnections();

    if (simpleConnections.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty">
            ${this.connections.length === 0 ? 'No connections found' : 'No active connections'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = simpleConnections.map((conn, index) => {
      const connectionId = this.generateSimpleConnectionId(conn);
      return `
        <tr class="${conn.isNew ? 'new-connection' : ''} dark-row" data-connection-id="${connectionId}">
          <td title="${conn.process_name || 'Unknown'}">
            <span class="process-name">${conn.process_name || 'Unknown'}</span>
          </td>
          <td>
            ${this.formatRemoteConnectionWithHostname(conn)}
          </td>
          <td>
            <span class="port-badge">${conn.remote_port || 'N/A'}</span>
          </td>
          <td>
            <span class="protocol-badge protocol-${conn.protocol}">${conn.protocol ? conn.protocol.toUpperCase() : 'N/A'}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  getSimpleConnections() {
    // Filter out connections without process ID and group by process-remote combination
    const validConnections = this.connections.filter(conn => 
      conn.process_id && conn.process_id !== 'N/A' && conn.process_id !== 0
    );

    // Group by process name and remote address to show unique connections
    const uniqueConnections = new Map();
    
    validConnections.forEach(conn => {
      const key = `${conn.process_name}-${conn.remote_address}-${conn.remote_port}-${conn.protocol}`;
      
      if (!uniqueConnections.has(key)) {
        uniqueConnections.set(key, {
          ...conn,
          isNew: conn.isNew
        });
      }
    });

    return Array.from(uniqueConnections.values()).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  generateSimpleConnectionId(conn) {
    const key = `${conn.process_name}-${conn.remote_address}-${conn.remote_port}-${conn.protocol}`;
    return 'SIMPLE_' + btoa(key).replace(/[^a-zA-Z0-9]/g, '');
  }

  formatRemoteConnectionWithHostname(conn) {
    const address = conn.remote_address;
    const port = conn.remote_port;
    const hostname = conn.remote_hostname;

    if (!address || address === '*') {
      return '<span class="no-connections">No remote connection</span>';
    }

    // If we have a hostname and it's different from the IP, show both
    if (hostname && hostname !== address) {
      return `
        <div class="hostname-info">
          <span class="hostname-primary">${hostname}</span>
          <span class="hostname-secondary">${address}</span>
        </div>
      `;
    }

    // Otherwise just show IP
    return `<span class="hostname-primary">${address}</span>`;
  }

  showSimpleConnectionsError() {
    const tbody = this.simpleConnectionsBody;
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="loading">
          Failed to load connections. <button onclick="window.dashboard.loadSimpleConnections()" class="btn btn-primary">Retry</button>
        </td>
      </tr>
    `;
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      // Load statistics
      await this.loadStatistics();
      
      // Load recent connections based on current mode
      if (this.currentMode === 'simple') {
        await this.loadSimpleConnections();
      } else {
        await this.loadConnections();
      }
      
      // Load process list for filter (only in expert mode)
      if (this.currentMode === 'expert') {
        await this.loadProcessList();
      }

      // Setup tooltips and UI enhancements
      this.setupTooltips();
      
      // Start meta timer for continuous refresh time updates
      this.startMetaTimer();
      
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

      // Update last refresh time for proper auto-refresh timing
      this.lastRefresh = Date.now();
      this.nextRefreshAt = this.lastRefresh + (this.autoRefresh.interval * 1000);
      this.updateRefreshMeta();

      // Cleanup old expanded connection IDs periodically
      this.cleanupExpandedConnections();

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

    // Render based on current mode
    if (this.currentMode === 'simple') {
      this.renderSimpleConnections();
    } else {
      this.renderConnections();
    }
    
    // Update statistics
    this.loadStatistics();

    // Remove "new" flag after 30 seconds
    setTimeout(() => {
      newConnections.forEach(conn => {
        conn.isNew = false;
      });
      if (this.currentMode === 'simple') {
        this.renderSimpleConnections();
      } else {
        this.renderConnections();
      }
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
      // Filter out connections without process ID
      if (!conn.process_id || conn.process_id === 'N/A' || conn.process_id === 0) {
        return false;
      }
      
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
   * Group connections by process ID and aggregate port information
   */
  deduplicateConnections(connections) {
    const processGroups = new Map();

    // Group connections by process ID
    connections.forEach(conn => {
      const pid = conn.process_id;
      if (!processGroups.has(pid)) {
        processGroups.set(pid, {
          process_id: pid,
          process_name: conn.process_name,
          user_name: conn.user_name,
          timestamp: conn.timestamp,
          isNew: conn.isNew,
          connections: [],
          localPorts: new Set(),
          remotePorts: new Set(),
          protocols: new Set(),
          states: new Set(),
          remoteAddresses: new Set(),
          totalConnections: 0
        });
      }
      
      const group = processGroups.get(pid);
      group.connections.push(conn);
      group.totalConnections++;
      
      // Collect unique ports and other info
      if (conn.local_port && conn.local_port !== 0) {
        group.localPorts.add(conn.local_port);
      }
      if (conn.remote_port && conn.remote_port !== 0) {
        group.remotePorts.add(conn.remote_port);
      }
      if (conn.protocol) {
        group.protocols.add(conn.protocol.toUpperCase());
      }
      if (conn.state && conn.state !== 'UNKNOWN') {
        group.states.add(conn.state);
      }
      if (conn.remote_address && conn.remote_address !== '*' && conn.remote_address !== '0.0.0.0') {
        group.remoteAddresses.add(conn.remote_address);
      }
      
      // Use the most recent timestamp
      if (new Date(conn.timestamp) > new Date(group.timestamp)) {
        group.timestamp = conn.timestamp;
        group.isNew = conn.isNew;
      }
    });

    // Convert to array and format for display
    const result = Array.from(processGroups.values()).map(group => {
      const localPortsArray = Array.from(group.localPorts).sort((a, b) => a - b);
      const remotePortsArray = Array.from(group.remotePorts).sort((a, b) => a - b);
      const protocolsArray = Array.from(group.protocols);
      const statesArray = Array.from(group.states);
      const remoteAddressesArray = Array.from(group.remoteAddresses);

      return {
        process_id: group.process_id,
        process_name: group.process_name,
        user_name: group.user_name,
        timestamp: group.timestamp,
        isNew: group.isNew,
        
        // Aggregated information
        localPortsList: localPortsArray,
        remotePortsList: remotePortsArray,
        protocolsList: protocolsArray,
        statesList: statesArray,
        remoteAddressesList: remoteAddressesArray,
        totalConnections: group.totalConnections,
        allConnections: group.connections,
        
        // For display compatibility
        protocol: protocolsArray.join('/'),
        local_port: localPortsArray.length > 0 ? localPortsArray[0] : 0,
        remote_port: remotePortsArray.length > 0 ? remotePortsArray[0] : 0,
        local_address: group.connections[0]?.local_address || '*',
        remote_address: remoteAddressesArray.length > 0 ? remoteAddressesArray[0] : '*',
        state: statesArray.join('/'),
        remote_hostname: group.connections[0]?.remote_hostname,
        
        // Mark as grouped
        isGrouped: true,
        duplicateCount: group.totalConnections
      };
    });

    // Sort by timestamp (newest first)
    return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Render connections table
   */
  renderConnections() {
    const tbody = document.getElementById('connectionsBody');
    const filteredConnections = this.getFilteredConnections();
    const deduplicatedConnections = this.deduplicateConnections(filteredConnections);

  // Build a map from connectionId -> aggregated/grouped connection object for toggle usage
  this.connectionIdMap = new Map();

    // Update filter results counter
    this.updateResultsCounter(deduplicatedConnections.length, filteredConnections.length);

    if (deduplicatedConnections.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty">
            ${this.connections.length === 0 ? 'No connections found' : 'No connections match the current filters'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = deduplicatedConnections.map((conn, index) => {
      const connectionId = this.generateConnectionId(conn);
      const isExpanded = this.isConnectionExpanded(conn);
      this.connectionIdMap.set(connectionId, conn);
      // Add dark-row class for all rows for dark theme enforcement
      return `
        <tr class="${conn.isNew ? 'new-connection' : ''} ${conn.isGrouped ? 'grouped-connection' : ''} dark-row" data-connection-id="${connectionId}">
          <td>
            <button class="expand-btn" onclick="window.dashboard.toggleConnectionDetails('${connectionId}', ${index})" 
                    aria-label="Expand connection details" 
                    aria-expanded="${isExpanded}"
                    title="${isExpanded ? 'Hide' : 'Show'} connection details">
              <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
            </button>
          </td>
          <td>${this.formatTime(conn.timestamp)}</td>
          <td title="${conn.process_name || 'Unknown'}">
            <span class="process-name">${conn.process_name || 'Unknown'}</span>
            ${conn.totalConnections > 1 ? `<span class="connection-count-badge" title="${conn.totalConnections} connections">${conn.totalConnections}</span>` : ''}
          </td>
          <td title="Process ID">${conn.process_id || 'N/A'}</td>
          <td>${conn.user_name || 'Unknown'}</td>
          <td><span class="protocol-mixed">${conn.protocolsList ? conn.protocolsList.join('/') : conn.protocol.toUpperCase()}</span></td>
          <td title="Local ports: ${conn.localPortsList ? conn.localPortsList.join(', ') : 'None'}">
            ${this.formatPortsList(conn.localPortsList)}
          </td>
          <td title="Remote addresses and ports">
            ${this.formatRemoteConnections(conn)}
          </td>
          <td><span class="state-mixed">${conn.statesList ? conn.statesList.join('/') : (conn.state || 'UNKNOWN')}</span></td>
        </tr>
        <tr class="connection-details dark-row" id="details-${connectionId}" style="display: ${isExpanded ? 'table-row' : 'none'};">
          <td colspan="9">
            <div class="details-content">
              ${this.renderConnectionDetails(conn, connectionId)}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Apply saved column widths
    this.applyColumnWidths();

    // Load additional details for expanded connections
    deduplicatedConnections.forEach((conn, index) => {
      if (this.isConnectionExpanded(conn)) {
        const connectionId = this.generateConnectionId(conn);
        this.loadAdditionalConnectionDetails(connectionId, conn);
      }
    });
  }

  /**
   * Show connections loading error
   */
  showConnectionsError() {
    const tbody = document.getElementById('connectionsBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="loading">
          Failed to load connections. <button onclick="window.dashboard.loadConnections()" class="btn btn-primary">Retry</button>
        </td>
      </tr>
    `;
  }

  /**
   * Toggle connection details display
   */
  toggleConnectionDetails(connectionId, index) {
    const detailsRow = document.getElementById(`details-${connectionId}`);
    const expandBtn = document.querySelector(`[data-connection-id="${connectionId}"] .expand-btn`);
    if (!expandBtn || !detailsRow) return; // safety
    const expandIcon = expandBtn.querySelector('.expand-icon');

    // Retrieve the aggregated/grouped connection object we stored during render
    const conn = this.connectionIdMap?.get(connectionId);

    const isCurrentlyHidden = detailsRow.style.display === 'none';
    if (isCurrentlyHidden) {
      detailsRow.style.display = 'table-row';
      expandIcon.textContent = '▼';
      expandBtn.setAttribute('aria-expanded', 'true');
      expandBtn.title = 'Hide connection details';
      // Persist expanded state directly via connectionId
      this.expandedConnections.add(connectionId);
      this.saveExpandedConnections();
      if (conn) {
        this.loadAdditionalConnectionDetails(connectionId, conn);
      }
    } else {
      detailsRow.style.display = 'none';
      expandIcon.textContent = '▶';
      expandBtn.setAttribute('aria-expanded', 'false');
      expandBtn.title = 'Show connection details';
      this.expandedConnections.delete(connectionId);
      this.saveExpandedConnections();
    }
  }

  /**
   * Render detailed connection information
   */
  renderConnectionDetails(conn, connectionId) {
    const isGrouped = conn.isGrouped;
    
    return `
      <div class="connection-details-grid">
        <div class="detail-section">
          <h4>Process Information</h4>
          <div class="detail-item">
            <span class="detail-label">Process Name:</span>
            <span class="detail-value">${conn.process_name || 'Unknown'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Process ID:</span>
            <span class="detail-value">${conn.process_id || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">User:</span>
            <span class="detail-value">${conn.user_name || 'Unknown'}</span>
          </div>
          <div class="detail-item" id="process-path-${connectionId}">
            <span class="detail-label">Executable Path:</span>
            <span class="detail-value loading-text">Loading...</span>
          </div>
          <div class="detail-item" id="process-args-${connectionId}">
            <span class="detail-label">Command Line:</span>
            <span class="detail-value loading-text">Loading...</span>
          </div>
          ${isGrouped ? `
          <div class="detail-item">
            <span class="detail-label">Total Connections:</span>
            <span class="detail-value">${conn.totalConnections}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="detail-section">
          <h4>Connection Summary</h4>
          ${isGrouped ? `
          <div class="detail-item">
            <span class="detail-label">Protocols:</span>
            <span class="detail-value">${conn.protocolsList.map(p => `<span class="protocol-badge">${p}</span>`).join(' ')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Local Ports:</span>
            <span class="detail-value">
              ${conn.localPortsList.length > 0 ? 
                conn.localPortsList.map(port => `<span class="port-badge">${port}</span>`).join(' ') : 
                'None'}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Remote Ports:</span>
            <span class="detail-value">
              ${conn.remotePortsList && conn.remotePortsList.length > 0 ? 
                conn.remotePortsList.map(port => `<span class="port-badge">${port}</span>`).join(' ') : 
                'None'}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Remote Addresses:</span>
            <span class="detail-value">
              ${conn.remoteAddressesList.length > 0 ? 
                conn.remoteAddressesList.map(addr => `<code>${addr}</code>`).join('<br>') : 
                'None'}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Connection States:</span>
            <span class="detail-value">${conn.statesList.map(s => `<span class="state-badge">${s}</span>`).join(' ')}</span>
          </div>
          ` : `
          <div class="detail-item">
            <span class="detail-label">Protocol:</span>
            <span class="detail-value protocol-${conn.protocol}">${conn.protocol.toUpperCase()}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">State:</span>
            <span class="detail-value state-${conn.state?.toLowerCase().replace(/[_\s]/g, '_')}">${conn.state || 'UNKNOWN'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Local Address:</span>
            <span class="detail-value">${this.formatAddress(conn.local_address, conn.local_port)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Remote Address:</span>
            <span class="detail-value">${this.formatAddress(conn.remote_address, conn.remote_port)}</span>
          </div>
          ${conn.remote_hostname ? `
          <div class="detail-item">
            <span class="detail-label">Remote Hostname:</span>
            <span class="detail-value">${conn.remote_hostname}</span>
          </div>
          ` : ''}
          `}
        </div>
        
        <div class="detail-section">
          <h4>Additional Information</h4>
          <div class="detail-item">
            <span class="detail-label">Latest Activity:</span>
            <span class="detail-value">${this.formatFullTime(conn.timestamp)}</span>
          </div>
          ${conn.bytes_sent || conn.bytes_received ? `
          <div class="detail-item">
            <span class="detail-label">Data Transfer:</span>
            <span class="detail-value">
              ↑ ${this.formatBytes(conn.bytes_sent || 0)} 
              ↓ ${this.formatBytes(conn.bytes_received || 0)}
            </span>
          </div>
          ` : ''}
          ${isGrouped && conn.allConnections ? `
          <div class="detail-item">
            <span class="detail-label">Connection Details:</span>
            <span class="detail-value">
              <div class="connection-list">
                ${conn.allConnections.slice(0, 10).map(c => 
                  `<div class="connection-entry">
                    ${c.protocol.toUpperCase()} ${this.formatAddress(c.local_address, c.local_port)} → ${this.formatAddress(c.remote_address, c.remote_port)} (${c.state})
                  </div>`
                ).join('')}
                ${conn.allConnections.length > 10 ? `<div class="connection-more">... and ${conn.allConnections.length - 10} more</div>` : ''}
              </div>
            </span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Load additional connection details like process path and command line
   */
  async loadAdditionalConnectionDetails(connectionId, conn) {
    if (!conn || !conn.process_id) {
      this.updateProcessDetails(connectionId, 'N/A', 'N/A');
      return;
    }

    try {
      // Fetch detailed process information
      const response = await fetch(`/api/process/${conn.process_id}`);
      if (response.ok) {
        const processInfo = await response.json();
        this.updateProcessDetails(
          connectionId, 
          processInfo.executablePath || 'N/A',
          processInfo.commandLine || 'N/A'
        );
      } else {
        // Fall back to basic information
        this.updateProcessDetails(connectionId, 'N/A', 'N/A');
      }
    } catch (error) {
      console.error('Error loading process details:', error);
      this.updateProcessDetails(connectionId, 'Error loading', 'Error loading');
    }
  }

  /**
   * Update process details in the UI
   */
  updateProcessDetails(connectionId, executablePath, commandLine) {
    const pathElement = document.getElementById(`process-path-${connectionId}`);
    const argsElement = document.getElementById(`process-args-${connectionId}`);
    
    if (pathElement) {
      const valueSpan = pathElement.querySelector('.detail-value');
      valueSpan.innerHTML = executablePath === 'N/A' || executablePath === 'Error loading' 
        ? executablePath 
        : `<span class="path-text">${this.escapeHtml(executablePath)}</span>`;
      valueSpan.classList.remove('loading-text');
      if (executablePath !== 'N/A' && executablePath !== 'Error loading') {
        valueSpan.title = executablePath; // Full path in tooltip
      }
    }
    
    if (argsElement) {
      const valueSpan = argsElement.querySelector('.detail-value');
      if (commandLine === 'N/A' || commandLine === 'Error loading') {
        valueSpan.textContent = commandLine;
      } else {
        // Show full command line with proper wrapping - no truncation
        valueSpan.innerHTML = `<span class="command-line-text">${this.escapeHtml(commandLine)}</span>`;
        valueSpan.title = commandLine; // Full command line in tooltip for copy/paste
      }
      valueSpan.classList.remove('loading-text');
    }
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update monitoring status
   */
  updateMonitoringStatus(status) {
    // Update any monitoring status indicators if needed
    console.log('Monitoring status:', status);
  }

  /**
   * Generate a unique identifier for a connection
   */
  generateConnectionId(conn) {
    // For grouped (process-level) rows, expansion should persist per PID only
    if (conn.isGrouped && (conn.process_id || conn.process_id === 0)) {
      return `PID_${conn.process_id}`;
    }
    // For non-grouped rows, use PID + unique connection signature (not just PID)
    const idParts = [
      conn.process_id || '0',
      conn.protocol || 'unknown',
      conn.local_address || '*',
      conn.local_port || '0',
      conn.remote_address || '*',
      conn.remote_port || '0'
    ];
    return 'CID_' + btoa(idParts.join('|')).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Check if a connection is expanded
   */
  isConnectionExpanded(conn) {
    const connectionId = this.generateConnectionId(conn);
    return this.expandedConnections.has(connectionId);
  }

  /**
   * Toggle connection expansion state
   */
  setConnectionExpanded(conn, expanded) {
    const connectionId = this.generateConnectionId(conn);
    if (expanded) {
      this.expandedConnections.add(connectionId);
    } else {
      this.expandedConnections.delete(connectionId);
    }
    // Save to localStorage
    this.saveExpandedConnections();
  }

  /**
   * Load expanded connections from localStorage
   */
  loadExpandedConnections() {
    const saved = localStorage.getItem('glassnet-expanded-connections');
    if (saved) {
      try {
        const expandedArray = JSON.parse(saved);
        return new Set(expandedArray);
      } catch (e) {
        console.warn('Failed to parse saved expanded connections:', e);
      }
    }
    return new Set();
  }

  /**
   * Save expanded connections to localStorage
   */
  saveExpandedConnections() {
    const expandedArray = Array.from(this.expandedConnections);
    localStorage.setItem('glassnet-expanded-connections', JSON.stringify(expandedArray));
  }
  // (Legacy normalization removed due to stray block causing syntax error.)
  /**
   * Clean up old expanded connection IDs (optional, to prevent localStorage from growing too large)
   */
  cleanupExpandedConnections() {
    // Remove expanded state for connections that haven't been seen in a while
    const currentConnectionIds = new Set(this.connections.map(conn => this.generateConnectionId(conn)));
    let changed = false;
    
    for (const expandedId of this.expandedConnections) {
      if (!currentConnectionIds.has(expandedId)) {
        this.expandedConnections.delete(expandedId);
        changed = true;
      }
    }
    
    if (changed) {
      this.saveExpandedConnections();
    }
  }

  
  /**
   * Format time for display
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * Format duration in human-readable terms
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ago`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s ago`;
    } else {
      return `${seconds}s ago`;
    }
  }

  /**
   * Format full date and time for detailed view
   */
  formatFullTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
   * Format a list of ports for display
   */
  formatPortsList(portsList) {
    if (!portsList || portsList.length === 0) {
      return '<span class="no-ports">None</span>';
    }
    
    if (portsList.length <= 5) {
      return portsList.map(port => `<span class="port-badge">${port}</span>`).join(' ');
    }
    
    // Show first few ports and a count of remaining
    const visible = portsList.slice(0, 3);
    const remaining = portsList.length - 3;
    return visible.map(port => `<span class="port-badge">${port}</span>`).join(' ') + 
           ` <span class="port-more">+${remaining} more</span>`;
  }

  /**
   * Format remote connections information
   */
  formatRemoteConnections(conn) {
    if (!conn.remoteAddressesList || conn.remoteAddressesList.length === 0) {
      return '<span class="no-connections">No remote connections</span>';
    }
    
    const uniqueAddresses = conn.remoteAddressesList.length;
    const uniqueRemotePorts = conn.remotePortsList ? conn.remotePortsList.length : 0;
    
    if (uniqueAddresses === 1 && uniqueRemotePorts <= 1) {
      const address = conn.remoteAddressesList[0];
      const port = conn.remotePortsList && conn.remotePortsList.length > 0 ? conn.remotePortsList[0] : null;
      return `<span class="remote-connection">${address}${port ? ':' + port : ''}</span>`;
    }
    
    return `<span class="remote-summary">${uniqueAddresses} address${uniqueAddresses > 1 ? 'es' : ''}, ${uniqueRemotePorts} port${uniqueRemotePorts !== 1 ? 's' : ''}</span>`;
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
      <div class="toast-content">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
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
   * Setup column resizing for both expert and simple tables
   */
  setupColumnResizing() {
    // Setup expert table resizing
    this.setupTableColumnResizing('expertTable', 'expert');
    
    // Setup simple table resizing
    this.setupTableColumnResizing('simpleTable', 'simple');
  }

  /**
   * Setup column resizing for a specific table
   */
  setupTableColumnResizing(tableId, tableType) {
    const table = document.getElementById(tableId);
    if (!table) return; // Don't setup column resizing if table doesn't exist
    
    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
      // Add resizable class for visual feedback
      header.classList.add('resizable');
      header.style.position = 'relative';
      header.style.minWidth = '80px';
      
      // Don't allow resizing of expand column (expert table only)
      if (header.classList.contains('expand-column')) {
        header.classList.remove('resizable');
        return;
      }
      
      // Create unique storage key for this table type
      const storageKey = `glassnet-column-widths-${tableType}`;
      
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;
      
      const startResize = (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(header).width, 10);
        header.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      };
      
      const doResize = (e) => {
        if (!isResizing) return;
        
        const width = startWidth + e.clientX - startX;
        const minWidth = tableType === 'simple' ? 60 : 80;
        const maxWidth = tableType === 'simple' ? 400 : 500;
        
        if (width >= minWidth && width <= maxWidth) {
          header.style.width = width + 'px';
          
          // Save width for this specific table
          if (!this.columnWidths[tableType]) {
            this.columnWidths[tableType] = {};
          }
          this.columnWidths[tableType][index] = width;
        }
      };
      
      const stopResize = () => {
        if (isResizing) {
          isResizing = false;
          header.classList.remove('resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          this.saveColumnWidths();
        }
      };
      
      // Use the header's resize handle (CSS-based)
      header.addEventListener('mousedown', startResize);
      document.addEventListener('mousemove', doResize);
      document.addEventListener('mouseup', stopResize);
      
      // Also create a fallback resize handle for better compatibility
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.position = 'absolute';
      resizeHandle.style.top = '0';
      resizeHandle.style.right = '0';
      resizeHandle.style.width = '8px';
      resizeHandle.style.height = '100%';
      resizeHandle.style.cursor = 'col-resize';
      resizeHandle.style.backgroundColor = 'transparent';
      resizeHandle.style.zIndex = '1';
      header.appendChild(resizeHandle);
      
      resizeHandle.addEventListener('mousedown', startResize);
    });
  }

  /**
   * Load column widths from localStorage
   */
  loadColumnWidths() {
    const saved = localStorage.getItem('glassnet-column-widths');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Handle legacy format (flat array) and new format (object with table types)
        if (Array.isArray(parsed)) {
          // Convert legacy format to new format
          return {
            expert: parsed,
            simple: {}
          };
        }
        
        return parsed;
      } catch (e) {
        console.warn('Failed to parse saved column widths:', e);
      }
    }
    return {
      expert: {},
      simple: {}
    };
  }

  /**
   * Save column widths to localStorage
   */
  saveColumnWidths() {
    localStorage.setItem('glassnet-column-widths', JSON.stringify(this.columnWidths));
  }

  /**
   * Apply saved column widths to both tables
   */
  applyColumnWidths() {
    // Apply to expert table
    this.applyTableColumnWidths('expertTable', 'expert');
    
    // Apply to simple table
    this.applyTableColumnWidths('simpleTable', 'simple');
  }

  /**
   * Apply saved column widths to a specific table
   */
  applyTableColumnWidths(tableId, tableType) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
      if (this.columnWidths[tableType] && this.columnWidths[tableType][index]) {
        header.style.width = this.columnWidths[tableType][index] + 'px';
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
    this.updateRefreshButtonText();
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
  updateResultsCounter(deduplicatedCount, filteredCount = null) {
    const tableContainer = document.querySelector('.table-container h2');
    if (tableContainer) {
      const total = this.connections.length;
      
      if (filteredCount !== null && filteredCount !== deduplicatedCount) {
        // Show deduplicated count and filtered count
        if (deduplicatedCount === total) {
          tableContainer.textContent = `Live Network Connections (${deduplicatedCount} unique, ${filteredCount} total)`;
        } else {
          tableContainer.textContent = `Live Network Connections (${deduplicatedCount} unique of ${filteredCount} filtered, ${total} total)`;
        }
      } else {
        // Show simple count
        if (deduplicatedCount === total) {
          tableContainer.textContent = `Live Network Connections (${total})`;
        } else {
          tableContainer.textContent = `Live Network Connections (${deduplicatedCount} of ${total})`;
        }
      }
    }
  }

  /**
   * Toggle auto-refresh functionality
   */
  setAutoRefreshEnabled(enabled) {
    console.log(`[${this.instanceId}] setAutoRefreshEnabled called with: ${enabled}`);
    this.autoRefresh.enabled = enabled;
    localStorage.setItem('glassnet-auto-refresh-enabled', enabled ? 'true' : 'false');
    
    const toggleBtn = document.getElementById('autoRefreshToggle');
    if (toggleBtn) {
      if (enabled) {
        toggleBtn.textContent = '⏸️ Disable';
        toggleBtn.classList.remove('btn-secondary');
        toggleBtn.classList.add('btn-primary');
      } else {
        toggleBtn.textContent = '▶️ Enable';
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-secondary');
      }
    }
    
    if (enabled) {
      this.scheduleAutoRefresh();
    } else {
      this.clearAutoRefreshTimer();
      this.nextRefreshAt = null;
      this.updateRefreshMeta();
      // Start meta timer to keep updating "Last" time even when auto-refresh is disabled
      this.startMetaTimer();
    }
    
    this.updateRefreshButtonText();
  }

  clearAutoRefreshTimer() {
    console.log(`[${this.instanceId}] clearAutoRefreshTimer called.`);
    if (this.autoRefresh.timer) {
      console.log(`[${this.instanceId}] Clearing refresh timer: ${this.autoRefresh.timer}`);
      clearInterval(this.autoRefresh.timer);
      this.autoRefresh.timer = null;
    } else {
      console.log(`[${this.instanceId}] No refresh timer to clear.`);
    }
    if (this.metaTimer) {
      console.log(`[${this.instanceId}] Clearing meta timer: ${this.metaTimer}`);
      clearInterval(this.metaTimer);
      this.metaTimer = null;
    }
  }

  scheduleAutoRefresh(force = false) {
    console.log(`[${this.instanceId}] scheduleAutoRefresh called.`);
    // Clear any existing timer first
    this.clearAutoRefreshTimer(); 

    // Only schedule if auto-refresh is enabled
    if (!this.autoRefresh.enabled) {
      console.log(`[${this.instanceId}] Auto-refresh disabled, not scheduling timer.`);
      this.updateRefreshMeta();
      return;
    }

    console.log(`[${this.instanceId}] Creating new refresh timer with interval ${this.autoRefresh.interval}s.`);
    this.autoRefresh.timer = setInterval(() => {
      console.log(`[${this.instanceId}] Refresh timer fired.`);
      if (this.autoRefresh.enabled) {
        if (this.currentMode === 'simple') {
          this.loadSimpleConnections();
        } else {
          this.loadConnections();
        }
      }
    }, this.autoRefresh.interval * 1000);

    this.lastRefresh = Date.now();
    this.nextRefreshAt = this.lastRefresh + (this.autoRefresh.interval * 1000);
    this.updateRefreshMeta();
    this.startMetaTimer();
  }

  startMetaTimer() {
    if (this.metaTimer) return;
    this.metaTimer = setInterval(() => {
      // Keep running if auto-refresh is enabled OR if we have a last refresh time to show
      if (!this.autoRefresh.enabled && !this.nextRefreshAt && !this.lastRefresh) {
        clearInterval(this.metaTimer);
        this.metaTimer = null;
        return;
      }
      this.updateRefreshMeta();
    }, 1000);
  }

  /** Update refresh button text */
  updateRefreshButtonText() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (!refreshBtn) return;
    
    const hasFilters = Object.values(this.filters).some(filter => filter !== '');
    
    if (this.autoRefresh.enabled) {
      if (hasFilters) {
        refreshBtn.textContent = `🔄 Auto-refresh (${this.autoRefresh.interval}s, filtered)`;
      } else {
        refreshBtn.textContent = `🔄 Auto-refresh (${this.autoRefresh.interval}s)`;
      }
      refreshBtn.classList.add('btn-primary');
      refreshBtn.classList.remove('btn-secondary');
    } else {
      if (hasFilters) {
        refreshBtn.textContent = `🔄 Refresh (filtered)`;
        refreshBtn.classList.add('has-filters');
      } else {
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.classList.remove('has-filters');
      }
      refreshBtn.classList.remove('btn-primary');
    }
    this.updateRefreshMeta();
  }

  updateRefreshMeta() {
    const lastEl = document.getElementById('lastRefreshInfo');
    const nextEl = document.getElementById('nextRefreshInfo');
    if (lastEl) {
      if (this.lastRefresh) {
        const timeSince = Date.now() - this.lastRefresh;
        lastEl.textContent = 'Last: ' + this.formatDuration(timeSince);
        lastEl.title = 'Last refresh: ' + new Date(this.lastRefresh).toLocaleString();
      } else {
        lastEl.textContent = 'Last: --';
        lastEl.title = 'No refresh yet';
      }
    }
    if (nextEl) {
      if (this.autoRefresh.enabled && this.nextRefreshAt) {
        const secs = Math.max(0, Math.round((this.nextRefreshAt - Date.now())/1000));
        if (secs === 0) {
          nextEl.textContent = 'Next: refreshing...';
        } else {
          nextEl.textContent = 'Next: ' + secs + 's';
        }
        nextEl.title = 'Next refresh in ' + secs + ' seconds';
      } else {
        nextEl.textContent = 'Next: --';
        nextEl.title = 'Auto-refresh disabled';
      }
    }
  }
}

// Initialize dashboard when DOM is loaded
// Note: We assign the instance to window.dashboard explicitly to avoid the
// browser's global ID-to-element mapping (the div with id="dashboard") from
// shadowing our object. This fixes errors like
// "window.dashboard.loadInitialData is not a function" where window.dashboard
// was actually the DOM element, not the Dashboard instance.
// Also guard against duplicate instantiation (e.g., via hot reload) which could
// leave orphaned auto-refresh timers running.
function createOrReuseDashboard() {
  // If an old instance exists, stop its timer before replacing
  if (window.dashboard && window.dashboard.clearAutoRefreshTimer) {
    try { window.dashboard.clearAutoRefreshTimer(); } catch (_) {}
  }
  window.dashboard = new Dashboard();
  console.log('[GlassNet] Dashboard instance ready. Auto-refresh:', window.dashboard.autoRefresh.enabled);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createOrReuseDashboard();
  });
} else {
  createOrReuseDashboard();
}
