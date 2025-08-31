/**
 * History component for viewing historical network connections
 */

class History {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 50;
    this.totalPages = 0;
    this.filters = {
      range: '3d', // 15m,30m,1h,24h,3d,7d
      process: ''
    };
    this.expanded = new Set(this.loadExpanded());
    this.connections = [];
    this.init();
  }

  /**
   * Initialize history component
   */
  init() {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Load history button
    document.getElementById('loadHistoryBtn').addEventListener('click', () => {
      this.loadHistory();
    });

    // Filter controls
    document.getElementById('historyDays').addEventListener('change', (e) => {
      this.filters.range = e.target.value;
    });

    document.getElementById('historyProcess').addEventListener('change', (e) => {
      this.filters.process = e.target.value;
    });

    // Pagination
    document.getElementById('prevPageBtn').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadHistory();
      }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
      this.currentPage++;
      this.loadHistory();
    });
  }

  /**
   * Load historical data
   */
  async loadHistory() {
    try {
      this.showLoading(true);

      // Calculate since timestamp
  const sinceMs = this.parseRangeToMs(this.filters.range);
  const since = new Date(Date.now() - sinceMs).toISOString();

      const params = new URLSearchParams({
        page: this.currentPage.toString(),
        pageSize: this.pageSize.toString(),
        since: since
      });

      if (this.filters.process) {
        params.append('process', this.filters.process);
      }

      const response = await fetch(`/api/connections/history?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

  const data = await response.json();
  this.connections = data.connections || [];
  this.renderHistory();
      this.updatePagination(data);

      // Load process list for filter if empty
      if (this.currentPage === 1) {
        await this.loadProcessList();
      }

    } catch (error) {
      console.error('Error loading history:', error);
      this.showHistoryError(error.message);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Load process list for filters
   */
  async loadProcessList() {
    try {
      const response = await fetch('/api/processes');
      const data = await response.json();

      const processFilter = document.getElementById('historyProcess');
      
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
   * Render history table
   */
  renderHistory() {
    const tbody = document.getElementById('historyBody');

    if (this.connections.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty">
            No connections found for the selected time period
          </td>
        </tr>
      `;
      return;
    }

    // Group connections by process like Dashboard does
    const groupedConnections = this.groupConnectionsByProcess(this.connections);

    tbody.innerHTML = groupedConnections.map((conn, idx) => {
      const connectionId = this.generateConnectionId(conn);
      const expanded = this.expanded.has(connectionId);
      return `
        <tr data-history-id="${connectionId}">
          <td>
            <button class="expand-btn" onclick="historyComponent.toggleDetails('${connectionId}')" aria-expanded="${expanded}" title="${expanded ? 'Hide' : 'Show'} details">
              <span class="expand-icon">${expanded ? '▼' : '▶'}</span>
            </button>
          </td>
          <td>${this.formatDateTime(conn.timestamp)}</td>
          <td title="${conn.process_name || 'Unknown'}">
            <span class="process-name">${this.truncateText(conn.process_name || 'Unknown', 20)}</span>
            ${conn.totalConnections > 1 ? `<span class="connection-count-badge" title="${conn.totalConnections} connections">${conn.totalConnections}</span>` : ''}
          </td>
          <td>${conn.user_name || 'Unknown'}</td>
          <td><span class="protocol-mixed">${conn.protocolsList ? conn.protocolsList.join('/') : conn.protocol.toUpperCase()}</span></td>
          <td title="Local ports: ${conn.localPortsList ? conn.localPortsList.join(', ') : 'None'}">
            ${this.formatPortsList(conn.localPortsList)}
          </td>
          <td title="Remote addresses and ports">
            ${this.formatRemoteConnections(conn)}
          </td>
          <td title="${this.getRemoteHostnameTooltip(conn)}">${this.formatRemoteHostname(conn)}</td>
          <td><span class="state-mixed">${conn.statesList ? conn.statesList.join('/') : (conn.state || 'UNKNOWN')}</span></td>
        </tr>
        <tr id="history-details-${connectionId}" class="connection-details" style="display:${expanded ? 'table-row':'none'};">
          <td colspan="9">
            <div class="details-content">
              ${this.renderDetails(conn, connectionId)}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    // Load process path for expanded rows
    groupedConnections.forEach(conn => {
      const id = this.generateConnectionId(conn);
      if (this.expanded.has(id)) {
        this.loadProcessDetails(id, conn.process_id);
      }
    });
  }

  /**
   * Update pagination controls
   */
  updatePagination(data) {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');

    // Update page info
    pageInfo.textContent = `Page ${this.currentPage}`;

    // Update button states
    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = !data.hasMore;
  }

  /**
   * Show/hide loading state
   */
  showLoading(show) {
    const tbody = document.getElementById('historyBody');
    const loadBtn = document.getElementById('loadHistoryBtn');

    if (show) {
    tbody.innerHTML = `
        <tr>
      <td colspan="9" class="loading">
            Loading historical data...
          </td>
        </tr>
      `;
      loadBtn.disabled = true;
      loadBtn.textContent = '⏳ Loading...';
    } else {
      loadBtn.disabled = false;
      loadBtn.innerHTML = '📊 Load History';
    }
  }

  /**
   * Show history loading error
   */
  showHistoryError(message) {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = `
      <tr>
  <td colspan="9" class="loading">
          Failed to load history: ${message}
          <br><button onclick="history.loadHistory()" class="btn btn-primary">Retry</button>
        </td>
      </tr>
    `;
  }

  /**
   * Export history data as CSV
   */
  exportToCsv() {
    if (this.connections.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Timestamp',
      'Process Name',
      'User',
      'Protocol',
      'Local Address',
      'Remote Address',
      'Remote Hostname',
      'State'
    ];

    const csvContent = [
      headers.join(','),
      ...this.connections.map(conn => [
        `"${conn.timestamp}"`,
        `"${conn.process_name || 'Unknown'}"`,
        `"${conn.user_name || 'Unknown'}"`,
        `"${conn.protocol}"`,
        `"${this.formatAddress(conn.local_address, conn.local_port)}"`,
        `"${this.formatAddress(conn.remote_address, conn.remote_port)}"`,
        `"${conn.remote_hostname && conn.remote_hostname !== conn.remote_address ? conn.remote_hostname : conn.remote_address || 'Unknown'}"`,
        `"${conn.state || 'UNKNOWN'}"`
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `glassnet-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Format date and time for display
   */
  formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
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
   * Format remote hostname for display
   */
  formatRemoteHostname(conn) {
    const address = conn.remote_address;
    const hostname = conn.remote_hostname;

    if (!address || address === '*') {
      return '*';
    }

    // If we have a hostname and it's different from the IP, show hostname
    if (hostname && hostname !== address) {
      return this.truncateText(hostname, 30);
    }

    // Otherwise show IP address
    return this.truncateText(address, 30);
  }

  /**
   * Get tooltip text for remote hostname
   */
  getRemoteHostnameTooltip(conn) {
    const address = conn.remote_address;
    const hostname = conn.remote_hostname;

    if (!address || address === '*') {
      return '*';
    }

    // If we have both hostname and IP, show both in tooltip
    if (hostname && hostname !== address) {
      return `${hostname} (${address})`;
    }

    // Otherwise just show IP
    return address;
  }

  /**
   * Truncate text with ellipsis
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Reset to first page
   */
  resetPage() {
    this.currentPage = 1;
  }

  /**
   * Group connections by process ID and aggregate port information
   */
  groupConnectionsByProcess(connections) {
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

  // --- New helper methods for enhanced history view ---
  parseRangeToMs(range) {
    const map = {
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    return map[range] || (3 * 24 * 60 * 60 * 1000);
  }

  generateConnectionId(conn) {
    // For grouped (process-level) rows, expansion should persist per PID only
    if (conn.isGrouped && (conn.process_id || conn.process_id === 0)) {
      return `HPID_${conn.process_id}`;
    }
    // For non-grouped rows, use the original logic
    return 'HID_' + btoa([
      conn.process_id || '0',
      conn.protocol || 'unknown',
      conn.local_address || '*',
      conn.local_port || '0',
      conn.remote_address || '*',
      conn.remote_port || '0',
      conn.timestamp
    ].join('|')).replace(/[^a-zA-Z0-9]/g, '');
  }

  renderDetails(conn, id) {
    const isGrouped = conn.isGrouped;
    
    return `
      <div class="connection-details-grid">
        <div class="detail-section">
          <h4>Process Information</h4>
          <div class="detail-item"><span class="detail-label">Name:</span><span class="detail-value">${conn.process_name || 'Unknown'}</span></div>
          <div class="detail-item"><span class="detail-label">PID:</span><span class="detail-value">${conn.process_id || 'N/A'}</span></div>
          <div class="detail-item" id="history-path-${id}"><span class="detail-label">Executable Path:</span><span class="detail-value loading-text">Loading...</span></div>
          <div class="detail-item" id="history-args-${id}"><span class="detail-label">Command Line:</span><span class="detail-value loading-text">Loading...</span></div>
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
          <div class="detail-item"><span class="detail-label">Local:</span><span class="detail-value">${this.formatAddress(conn.local_address, conn.local_port)}</span></div>
          <div class="detail-item"><span class="detail-label">Remote:</span><span class="detail-value">${this.formatAddress(conn.remote_address, conn.remote_port)}</span></div>
          <div class="detail-item"><span class="detail-label">Hostname:</span><span class="detail-value">${conn.remote_hostname || 'N/A'}</span></div>
          <div class="detail-item"><span class="detail-label">State:</span><span class="detail-value">${conn.state || 'UNKNOWN'}</span></div>
          `}
        </div>
        
        <div class="detail-section">
          <h4>Additional Information</h4>
          <div class="detail-item">
            <span class="detail-label">Latest Activity:</span>
            <span class="detail-value">${this.formatDateTime(conn.timestamp)}</span>
          </div>
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

  toggleDetails(id) {
    const row = document.getElementById(`history-details-${id}`);
    const btn = document.querySelector(`[data-history-id="${id}"] .expand-btn`);
    if (!row || !btn) return;
    const icon = btn.querySelector('.expand-icon');
    const expanded = row.style.display === 'table-row';
    if (expanded) {
      row.style.display = 'none';
      icon.textContent = '▶';
      btn.setAttribute('aria-expanded','false');
      this.expanded.delete(id);
    } else {
      row.style.display = 'table-row';
      icon.textContent = '▼';
      btn.setAttribute('aria-expanded','true');
      this.expanded.add(id);
      this.loadProcessDetails(id, this.connections.find(c => this.generateConnectionId(c) === id)?.process_id);
    }
    this.saveExpanded();
  }

  async loadProcessDetails(id, pid) {
    if (!pid) {
      this.updateHistoryProcessDetails(id,'N/A','N/A');
      return;
    }
    try {
      const res = await fetch(`/api/process/${pid}`);
      if (res.ok) {
        const info = await res.json();
        this.updateHistoryProcessDetails(id, info.executablePath || 'N/A', info.commandLine || 'N/A');
      } else {
        this.updateHistoryProcessDetails(id,'N/A','N/A');
      }
    } catch(e) {
      console.warn('History process detail load failed', e);
      this.updateHistoryProcessDetails(id,'Error','Error');
    }
  }

  updateHistoryProcessDetails(id, path, args) {
    const pathEl = document.getElementById(`history-path-${id}`);
    const argsEl = document.getElementById(`history-args-${id}`);
    if (pathEl) {
      const val = pathEl.querySelector('.detail-value');
      val.classList.remove('loading-text');
      val.innerHTML = (path === 'N/A' || path === 'Error') ? path : `<span class="path-text">${this.escapeHtml(path)}</span>`;
    }
    if (argsEl) {
      const val = argsEl.querySelector('.detail-value');
      val.classList.remove('loading-text');
      val.innerHTML = (args === 'N/A' || args === 'Error') ? args : `<span class="command-line-text">${this.escapeHtml(args)}</span>`;
    }
  }

  loadExpanded() {
    try { return JSON.parse(localStorage.getItem('glassnet-history-expanded')||'[]'); } catch { return []; }
  }
  saveExpanded() {
    localStorage.setItem('glassnet-history-expanded', JSON.stringify(Array.from(this.expanded)));
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// Initialize history when DOM is loaded
let historyComponent;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    historyComponent = new History();
  });
} else {
  historyComponent = new History();
}
