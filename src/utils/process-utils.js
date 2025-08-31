/**
 * Process utility functions for identifying and managing processes
 */

import { Platform } from './platform.js';

export class ProcessUtils {
  /**
   * Parse process information from platform-specific commands
   */
  static async getProcessList() {
    try {
      if (Platform.isWindows) {
        return await this.getWindowsProcesses();
      } else if (Platform.isMacOS) {
        return await this.getMacOSProcesses();
      } else if (Platform.isLinux) {
        return await this.getLinuxProcesses();
      }
    } catch (error) {
      console.error('Error getting process list:', error);
      return [];
    }
  }

  /**
   * Get Windows processes using tasklist
   */
  static async getWindowsProcesses() {
    const result = await Bun.spawn(['tasklist', '/fo', 'csv'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const output = await new Response(result.stdout).text();
    const lines = output.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];

    const processes = [];
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Parse CSV line (handle quoted fields)
      const fields = this.parseCSVLine(line);
      if (fields.length >= 5) {
        processes.push({
          name: fields[0].replace(/"/g, ''),
          pid: parseInt(fields[1].replace(/"/g, '')),
          sessionName: fields[2].replace(/"/g, ''),
          sessionNumber: fields[3].replace(/"/g, ''),
          memUsage: fields[4].replace(/"/g, '')
        });
      }
    }

    return processes;
  }

  /**
   * Get macOS processes using ps aux
   */
  static async getMacOSProcesses() {
    const result = await Bun.spawn(['ps', 'aux'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const output = await new Response(result.stdout).text();
    const lines = output.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];

    const processes = [];
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const fields = line.trim().split(/\s+/);
      if (fields.length >= 11) {
        processes.push({
          user: fields[0],
          pid: parseInt(fields[1]),
          cpu: parseFloat(fields[2]),
          mem: parseFloat(fields[3]),
          vsz: parseInt(fields[4]),
          rss: parseInt(fields[5]),
          tt: fields[6],
          stat: fields[7],
          started: fields[8],
          time: fields[9],
          command: fields.slice(10).join(' ')
        });
      }
    }

    return processes;
  }

  /**
   * Get Linux processes using ps aux
   */
  static async getLinuxProcesses() {
    // Same as macOS for now, but could be extended with Linux-specific features
    return await this.getMacOSProcesses();
  }

  /**
   * Get process info by PID
   */
  static async getProcessByPid(pid) {
    const processes = await this.getProcessList();
    return processes.find(p => p.pid === parseInt(pid));
  }

  /**
   * Get user information for a process
   */
  static async getProcessUser(pid) {
    try {
      if (Platform.isWindows) {
        const result = await Bun.spawn([
          'powershell', 
          '-Command', 
          `Get-WmiObject Win32_Process -Filter "ProcessId=${pid}" | Select-Object Name,ProcessId,@{Name="Owner";Expression={$_.GetOwner().User}} | ConvertTo-Json`
        ], {
          stdout: 'pipe',
          stderr: 'pipe'
        });

        const output = await new Response(result.stdout).text();
        const processInfo = JSON.parse(output);
        return processInfo.Owner || 'Unknown';
      } else {
        // For Unix systems, ps aux already includes user info
        const process = await this.getProcessByPid(pid);
        return process?.user || 'Unknown';
      }
    } catch (error) {
      console.error(`Error getting user for PID ${pid}:`, error);
      return 'Unknown';
    }
  }

  /**
   * Parse CSV line handling quoted fields
   */
  static parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) {
      fields.push(current.trim());
    }
    
    return fields;
  }

  /**
   * Extract process name from command line
   */
  static extractProcessName(commandLine) {
    if (!commandLine) return 'Unknown';
    
    // Handle different command line formats
    const parts = commandLine.split(/[\s/\\]+/);
    const executable = parts[parts.length - 1];
    
    // Remove file extension on Windows
    if (Platform.isWindows && executable.includes('.')) {
      return executable.split('.')[0];
    }
    
    return executable || 'Unknown';
  }
}
