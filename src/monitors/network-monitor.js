/**
 * Core network monitoring functionality
 */

import { Platform } from '../utils/platform.js';
import { ProcessUtils } from '../utils/process-utils.js';
import { DNSResolver } from '../utils/dns-resolver.js';

export class NetworkMonitor {
  constructor(database, config) {
    this.db = database;
    this.config = config;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastConnections = new Map();
    this.listeners = new Set();
  }

  /**
   * Start monitoring network connections
   */
  async start() {
    if (this.isMonitoring) {
      console.log('Network monitoring is already running');
      return;
    }

    console.log('Starting network monitoring...');
    this.isMonitoring = true;

    // Initial scan
    await this.scanConnections();

    // Set up periodic scanning
    this.monitoringInterval = setInterval(
      () => this.scanConnections(),
      this.config.monitoring.interval
    );

    console.log(`Network monitoring started with ${this.config.monitoring.interval}ms interval`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping network monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Network monitoring stopped');
  }

  /**
   * Add listener for real-time updates
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of new connections
   */
  notifyListeners(connections) {
    for (const listener of this.listeners) {
      try {
        listener(connections);
      } catch (error) {
        console.error('Error notifying listener:', error);
      }
    }
  }

  /**
   * Scan for current network connections
   */
  async scanConnections() {
    try {
      let connections = [];

      if (Platform.isWindows) {
        connections = await this.scanWindowsConnections();
      } else if (Platform.isMacOS) {
        connections = await this.scanMacOSConnections();
      } else if (Platform.isLinux) {
        connections = await this.scanLinuxConnections();
      }

      // Process and store new connections
      const newConnections = await this.processConnections(connections);
      
      if (newConnections.length > 0) {
        // Store in database
        for (const conn of newConnections) {
          this.db.insertConnection(conn);
        }

        // Notify listeners
        this.notifyListeners(newConnections);
      }

    } catch (error) {
      console.error('Error scanning connections:', error);
    }
  }

  /**
   * Scan Windows network connections
   */
  async scanWindowsConnections() {
    const connections = [];

    try {
      // Get network connections
      const netstatResult = await Bun.spawn(['netstat', '-ano'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const netstatOutput = await new Response(netstatResult.stdout).text();
      const lines = netstatOutput.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('Active') || trimmedLine.startsWith('Proto')) {
          continue;
        }

        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 5) {
          const protocol = parts[0].toLowerCase();
          const localAddr = parts[1];
          const remoteAddr = parts[2];
          const state = parts[3];
          const pid = parseInt(parts[4]);

          // Skip if not TCP/UDP or if we don't want loopback
          if (!['tcp', 'udp'].includes(protocol)) continue;
          if (!this.config.monitoring.includeLoopback && this.isLoopbackConnection(localAddr, remoteAddr)) {
            continue;
          }

          // Parse addresses
          const local = this.parseAddress(localAddr);
          const remote = this.parseAddress(remoteAddr);

          connections.push({
            protocol,
            localAddress: local.address,
            localPort: local.port,
            remoteAddress: remote.address,
            remotePort: remote.port,
            state,
            processId: pid
          });
        }
      }
    } catch (error) {
      console.error('Error scanning Windows connections:', error);
    }

    return connections;
  }

  /**
   * Scan macOS network connections
   */
  async scanMacOSConnections() {
    const connections = [];

    try {
      // Use lsof for better process information
      const lsofResult = await Bun.spawn(['lsof', '-i', '-P', '-n'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const lsofOutput = await new Response(lsofResult.stdout).text();
      const lines = lsofOutput.split('\n');

      console.log(`[DEBUG] lsof found ${lines.length} lines`);

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('COMMAND')) {
          continue;
        }

        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 9) {
          const command = parts[0];
          const pid = parseInt(parts[1]);
          const user = parts[2];
          const type = parts[4];
          const protocol = parts[7]; // TCP or UDP
          const node = parts[8]; // Address information

          // Filter for network connections
          if (!type.includes('IPv4') && !type.includes('IPv6')) continue;
          if (!['TCP', 'UDP'].includes(protocol)) continue;

          // Parse connection info
          const connInfo = this.parseMacOSConnection(protocol + ' ' + node);
          if (!connInfo) continue;

          // Skip if protocol not in config
          if (!this.config.monitoring.protocols.includes(connInfo.protocol)) continue;

          // Skip loopback if configured
          if (!this.config.monitoring.includeLoopback && 
              this.isLoopbackConnection(connInfo.localAddress, connInfo.remoteAddress)) {
            continue;
          }

          connections.push({
            protocol: connInfo.protocol,
            localAddress: connInfo.localAddress,
            localPort: connInfo.localPort,
            remoteAddress: connInfo.remoteAddress,
            remotePort: connInfo.remotePort,
            state: connInfo.state,
            processId: pid,
            processName: command,
            userName: user
          });
        }
      }

      console.log(`[DEBUG] Found ${connections.length} connections on macOS`);
    } catch (error) {
      console.error('Error scanning macOS connections:', error);
    }

    return connections;
  }

  /**
   * Scan Linux network connections
   */
  async scanLinuxConnections() {
    const connections = [];

    try {
      // Try ss first (more modern), fall back to netstat
      let command = ['ss', '-tulpn'];
      let result = await Bun.spawn(command, {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      let output = await new Response(result.stdout).text();
      
      // If ss fails, try netstat
      if (!output || result.exitCode !== 0) {
        command = ['netstat', '-tulpn'];
        result = await Bun.spawn(command, {
          stdout: 'pipe',
          stderr: 'pipe'
        });
        output = await new Response(result.stdout).text();
      }

      const lines = output.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('Netid') || trimmedLine.startsWith('Proto')) {
          continue;
        }

        const connInfo = this.parseLinuxConnection(trimmedLine);
        if (!connInfo) continue;

        // Skip if protocol not in config
        if (!this.config.monitoring.protocols.includes(connInfo.protocol)) continue;

        // Skip loopback if configured
        if (!this.config.monitoring.includeLoopback && 
            this.isLoopbackConnection(connInfo.localAddress, connInfo.remoteAddress)) {
          continue;
        }

        connections.push(connInfo);
      }
    } catch (error) {
      console.error('Error scanning Linux connections:', error);
    }

    return connections;
  }

  /**
   * Process connections and enrich with additional data
   */
  async processConnections(connections) {
    const newConnections = [];

    for (const conn of connections) {
      // Create connection ID for deduplication
      const connId = `${conn.protocol}:${conn.localAddress}:${conn.localPort}:${conn.remoteAddress}:${conn.remotePort}`;
      
      // Skip if we've seen this connection recently (within last scan)
      if (this.lastConnections.has(connId)) {
        continue;
      }

      // Mark as seen
      this.lastConnections.set(connId, Date.now());

      // Enrich with process information
      if (conn.processId && !conn.processName) {
        const processInfo = await ProcessUtils.getProcessByPid(conn.processId);
        if (processInfo) {
          conn.processName = processInfo.name || processInfo.command || 'Unknown';
          conn.userName = processInfo.user || 'Unknown';
        }
      }

      // Resolve hostname if enabled
      if (this.config.privacy.resolveHostnames && conn.remoteAddress && conn.remoteAddress !== '*') {
        const resolvedHostname = await DNSResolver.resolveHostname(conn.remoteAddress);
        // Only set hostname if resolution was successful and returned a valid hostname
        if (resolvedHostname && resolvedHostname !== conn.remoteAddress) {
          conn.remoteHostname = resolvedHostname;
        }
        // If resolution failed or returned null, don't set remoteHostname
      }

      // Set defaults for missing fields
      conn.processName = conn.processName || 'Unknown';
      conn.userName = conn.userName || 'Unknown';
      // Don't set a default for remoteHostname - leave it undefined if no hostname was resolved

      newConnections.push(conn);
    }

    // Clean up old connection tracking (keep only last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [connId, timestamp] of this.lastConnections.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.lastConnections.delete(connId);
      }
    }

    return newConnections;
  }

  /**
   * Parse address:port format
   */
  parseAddress(addressPort) {
    if (!addressPort || addressPort === '*:*') {
      return { address: '*', port: 0 };
    }

    const lastColon = addressPort.lastIndexOf(':');
    if (lastColon === -1) {
      return { address: addressPort, port: 0 };
    }

    const address = addressPort.substring(0, lastColon);
    const port = parseInt(addressPort.substring(lastColon + 1)) || 0;

    return { address: address === '*' ? '0.0.0.0' : address, port };
  }

  /**
   * Parse macOS lsof connection format
   */
  parseMacOSConnection(node) {
    // Format examples:
    // TCP 192.168.1.100:53124->142.250.185.110:443 (ESTABLISHED)
    // UDP *:53 
    
    const match = node.match(/^(TCP|UDP)\s+(.+?)(?:\s+\((.+?)\))?$/);
    if (!match) return null;

    const protocol = match[1].toLowerCase();
    const addressPart = match[2];
    const state = match[3] || 'UNKNOWN';

    if (addressPart.includes('->')) {
      // TCP with remote connection
      const [local, remote] = addressPart.split('->');
      const localAddr = this.parseAddress(local);
      const remoteAddr = this.parseAddress(remote);

      return {
        protocol,
        localAddress: localAddr.address,
        localPort: localAddr.port,
        remoteAddress: remoteAddr.address,
        remotePort: remoteAddr.port,
        state
      };
    } else {
      // Listening socket
      const localAddr = this.parseAddress(addressPart);
      return {
        protocol,
        localAddress: localAddr.address,
        localPort: localAddr.port,
        remoteAddress: '*',
        remotePort: 0,
        state: 'LISTEN'
      };
    }
  }

  /**
   * Parse Linux ss/netstat output
   */
  parseLinuxConnection(line) {
    const parts = line.split(/\s+/);
    
    if (parts.length < 4) return null;

    const protocol = parts[0].toLowerCase();
    const localAddr = this.parseAddress(parts[3]);
    
    let remoteAddr = { address: '*', port: 0 };
    let state = 'UNKNOWN';
    let processInfo = null;

    if (parts.length > 4 && parts[4] !== '0.0.0.0:*') {
      remoteAddr = this.parseAddress(parts[4]);
    }

    if (parts.length > 5) {
      state = parts[5];
    }

    // Extract process info if available (usually last field with users:(("process",pid,fd)))
    const processMatch = line.match(/users:\(\("([^"]+)",(\d+),\d+\)\)/);
    if (processMatch) {
      processInfo = {
        processName: processMatch[1],
        processId: parseInt(processMatch[2])
      };
    }

    return {
      protocol,
      localAddress: localAddr.address,
      localPort: localAddr.port,
      remoteAddress: remoteAddr.address,
      remotePort: remoteAddr.port,
      state,
      ...processInfo
    };
  }

  /**
   * Check if connection is loopback
   */
  isLoopbackConnection(localAddr, remoteAddr) {
    const loopbackPatterns = ['127.', '::1', 'localhost'];
    
    for (const pattern of loopbackPatterns) {
      if (localAddr?.includes(pattern) || remoteAddr?.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      interval: this.config.monitoring.interval,
      protocols: this.config.monitoring.protocols,
      includeLoopback: this.config.monitoring.includeLoopback,
      activeConnections: this.lastConnections.size,
      listeners: this.listeners.size
    };
  }
}
