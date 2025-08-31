/**
 * History component for viewing historical network connections
 */

class History {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 50;
    this.totalPages = 0;
    this.filters = {
      days: 3,
      process: ''
    };
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
      this.filters.days = parseInt(e.target.value);
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
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - this.filters.days);
      const since = sinceDate.toISOString();

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
          <td colspan="8" class="empty">
            No connections found for the selected time period
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.connections.map(conn => `
      <tr>
        <td>${this.formatDateTime(conn.timestamp)}</td>
        <td title="${conn.process_name || 'Unknown'}">${this.truncateText(conn.process_name || 'Unknown', 20)}</td>
        <td>${conn.user_name || 'Unknown'}</td>
        <td><span class="protocol-${conn.protocol}">${conn.protocol.toUpperCase()}</span></td>
        <td>${this.formatAddress(conn.local_address, conn.local_port)}</td>
        <td>${this.formatAddress(conn.remote_address, conn.remote_port)}</td>
        <td title="${this.getRemoteHostnameTooltip(conn)}">
          ${this.formatRemoteHostname(conn)}
        </td>
        <td><span class="state-${conn.state?.toLowerCase().replace(/[_\s]/g, '_')}">${conn.state || 'UNKNOWN'}</span></td>
      </tr>
    `).join('');
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
          <td colspan="8" class="loading">
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
        <td colspan="8" class="loading">
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
