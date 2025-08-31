/**
 * API routes for the GlassNet application
 */

export class APIRoutes {
  constructor(database, monitor) {
    this.db = database;
    this.monitor = monitor;
  }

  /**
   * Handle API requests
   */
  async handleRequest(request, url) {
    const { pathname } = url;
    const method = request.method;

    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      };

      // Handle preflight requests
      if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      let response;

      switch (pathname) {
        case '/api/connections':
          response = await this.getConnections(request);
          break;
        case '/api/connections/history':
          response = await this.getConnectionHistory(request);
          break;
        case '/api/connections/cleanup':
          response = await this.cleanupConnections(request);
          break;
        case '/api/stats':
          response = await this.getStatistics();
          break;
        case '/api/processes':
          response = await this.getProcesses();
          break;
        case '/api/status':
          response = await this.getMonitorStatus();
          break;
        case '/api/config':
          response = await this.getConfig();
          break;
        default:
          // Check for dynamic routes
          if (pathname.startsWith('/api/process/')) {
            const pid = pathname.split('/')[3];
            response = await this.getProcessDetails(pid);
          } else {
            response = new Response(
              JSON.stringify({ error: 'Not found' }), 
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
          }
      }

      // Add CORS headers to response
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });

    } catch (error) {
      console.error('API Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', message: error.message }), 
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }
  }

  /**
   * Get current connections
   */
  async getConnections(request) {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    
    const filters = {
      processName: url.searchParams.get('process'),
      protocol: url.searchParams.get('protocol'),
      remoteAddress: url.searchParams.get('remote'),
      state: url.searchParams.get('state'),
      since: url.searchParams.get('since')
    };

    // Remove null/undefined filters
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });

    const connections = this.db.getConnections(limit, offset, filters);
    
    return new Response(
      JSON.stringify({
        connections,
        total: connections.length,
        limit,
        offset,
        filters
      }), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  /**
   * Get connection history with pagination
   */
  async getConnectionHistory(request) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const pageSize = parseInt(url.searchParams.get('pageSize')) || 100;
    const offset = (page - 1) * pageSize;

    const filters = {
      processName: url.searchParams.get('process'),
      protocol: url.searchParams.get('protocol'),
      since: url.searchParams.get('since')
    };

    // Remove null/undefined filters
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });

    const connections = this.db.getConnections(pageSize, offset, filters);
    
    return new Response(
      JSON.stringify({
        connections,
        page,
        pageSize,
        hasMore: connections.length === pageSize,
        filters
      }), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  /**
   * Cleanup old connections
   */
  async cleanupConnections(request) {
    if (request.method !== 'DELETE') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    let deletedCount = 0;

    if (action === 'all') {
      // Clear all logs
      deletedCount = this.db.clearAllLogs();
    } else {
      // Clean old logs based on retention policy
      const retentionDays = parseInt(url.searchParams.get('days')) || 3;
      deletedCount = this.db.cleanOldRecords(retentionDays);
    }

    // Vacuum database to reclaim space
    this.db.vacuum();

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount,
        action: action || 'cleanup',
        message: `Successfully ${action === 'all' ? 'cleared all' : 'cleaned old'} connection records`
      }), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const stats = this.db.getStatistics();
    const monitorStatus = this.monitor.getStatus();
    
    // Add additional stats
    stats.databaseSize = this.db.getDatabaseSize();
    stats.monitoring = monitorStatus;
    stats.timestamp = new Date().toISOString();

    return new Response(
      JSON.stringify(stats), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  /**
   * Get unique processes for filtering
   */
  async getProcesses() {
    const processes = this.db.getUniqueProcesses();
    
    return new Response(
      JSON.stringify({ processes }), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  /**
   * Get monitoring status
   */
  async getMonitorStatus() {
    const status = this.monitor.getStatus();
    
    return new Response(
      JSON.stringify(status), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  /**
   * Get configuration
   */
  async getConfig() {
    // Don't expose sensitive config, only public settings
    const config = {
      monitoring: {
        interval: this.monitor.config.monitoring.interval,
        protocols: this.monitor.config.monitoring.protocols,
        includeLoopback: this.monitor.config.monitoring.includeLoopback
      },
      database: {
        retentionDays: this.monitor.config.database.retentionDays
      },
      privacy: {
        resolveHostnames: this.monitor.config.privacy.resolveHostnames
      }
    };

    return new Response(
      JSON.stringify(config), 
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  /**
   * Get detailed process information by PID
   */
  async getProcessDetails(pid) {
    try {
      const processId = parseInt(pid);
      if (isNaN(processId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid process ID' }), 
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Import ProcessUtils dynamically
      const { ProcessUtils } = await import('../utils/process-utils.js');
      const { Platform } = await import('../utils/platform.js');

      let processInfo = {
        pid: processId,
        executablePath: 'N/A',
        commandLine: 'N/A',
        workingDirectory: 'N/A',
        parentPid: 'N/A'
      };

      if (Platform.isWindows) {
        // Use PowerShell to get detailed process information
        try {
          const result = await Bun.spawn([
            'powershell', 
            '-Command', 
            `Get-CimInstance Win32_Process -Filter "ProcessId=${processId}" | Select-Object ProcessId,Name,ExecutablePath,CommandLine,WorkingSetSize,ParentProcessId | ConvertTo-Json`
          ], {
            stdout: 'pipe',
            stderr: 'pipe'
          });

          const output = await new Response(result.stdout).text();
          if (output.trim()) {
            const winProcessInfo = JSON.parse(output);
            processInfo.executablePath = winProcessInfo.ExecutablePath || 'N/A';
            processInfo.commandLine = winProcessInfo.CommandLine || 'N/A';
            processInfo.parentPid = winProcessInfo.ParentProcessId || 'N/A';
          }
        } catch (error) {
          console.error('Error getting Windows process details:', error);
        }
      } else {
        // Unix-like systems (macOS, Linux)
        try {
          // Try to get executable path and command line
          const psResult = await Bun.spawn(['ps', '-p', processId.toString(), '-o', 'pid,ppid,comm,args'], {
            stdout: 'pipe',
            stderr: 'pipe'
          });

          const psOutput = await new Response(psResult.stdout).text();
          const lines = psOutput.split('\n').filter(line => line.trim());
          
          if (lines.length > 1) { // Skip header line
            const processLine = lines[1].trim();
            const parts = processLine.split(/\s+/);
            
            if (parts.length >= 4) {
              processInfo.parentPid = parts[1];
              processInfo.commandLine = parts.slice(3).join(' ');
              
              // Try to extract executable path from command line
              const commandParts = processInfo.commandLine.split(' ');
              if (commandParts.length > 0) {
                processInfo.executablePath = commandParts[0];
              }
            }
          }

          // Try to get working directory on macOS/Linux
          try {
            const lsofResult = await Bun.spawn(['lsof', '-p', processId.toString(), '-d', 'cwd'], {
              stdout: 'pipe',
              stderr: 'pipe'
            });

            const lsofOutput = await new Response(lsofResult.stdout).text();
            const lsofLines = lsofOutput.split('\n');
            
            for (const line of lsofLines) {
              if (line.includes('cwd') && line.includes('DIR')) {
                const parts = line.trim().split(/\s+/);
                if (parts.length > 8) {
                  processInfo.workingDirectory = parts[parts.length - 1];
                  break;
                }
              }
            }
          } catch (error) {
            // lsof might not be available or might fail
            console.warn('Could not get working directory:', error.message);
          }

        } catch (error) {
          console.error('Error getting Unix process details:', error);
        }
      }

      return new Response(
        JSON.stringify(processInfo), 
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );

    } catch (error) {
      console.error('Error in getProcessDetails:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get process details',
          message: error.message 
        }), 
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
}
