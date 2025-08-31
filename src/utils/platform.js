/**
 * Platform detection utilities for cross-platform network monitoring
 */

export class Platform {
  static get current() {
    return process.platform;
  }

  static get isWindows() {
    return process.platform === 'win32';
  }

  static get isMacOS() {
    return process.platform === 'darwin';
  }

  static get isLinux() {
    return process.platform === 'linux';
  }

  static get isUnix() {
    return this.isMacOS || this.isLinux;
  }

  /**
   * Get platform-specific commands for network monitoring
   */
  static getNetworkCommands() {
    if (this.isWindows) {
      return {
        netstat: 'netstat -ano',
        processes: 'tasklist /fo csv',
        processInfo: 'powershell "Get-WmiObject Win32_Process | Select-Object ProcessId,Name,CommandLine,ExecutablePath | ConvertTo-Json"'
      };
    } else if (this.isMacOS) {
      return {
        netstat: 'netstat -anv',
        lsof: 'lsof -i -P -n',
        processes: 'ps aux'
      };
    } else if (this.isLinux) {
      return {
        netstat: 'netstat -tulpn',
        ss: 'ss -tulpn',
        lsof: 'lsof -i -P -n',
        processes: 'ps aux'
      };
    }
    
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  /**
   * Get platform-specific process identification method
   */
  static getProcessIdentifier() {
    if (this.isWindows) {
      return 'pid'; // Use PID from netstat to match with tasklist
    } else {
      return 'lsof'; // Use lsof to cross-reference with netstat
    }
  }

  /**
   * Check if elevated privileges are available/needed
   */
  static async checkPrivileges() {
    try {
      if (this.isWindows) {
        // Try to run a command that requires admin rights
        const result = await Bun.spawn(['powershell', '-Command', 'Get-WmiObject Win32_Process | Select-Object -First 1'], {
          stdout: 'pipe',
          stderr: 'pipe'
        });
        
        const output = await new Response(result.stdout).text();
        return !output.includes('Access is denied');
      } else {
        // Check if we can access privileged network info
        const result = await Bun.spawn(['id', '-u'], {
          stdout: 'pipe'
        });
        
        const uid = parseInt(await new Response(result.stdout).text());
        return uid === 0; // Root user
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get recommended browser command for each platform
   */
  static getBrowserCommand() {
    if (this.isWindows) {
      return 'start';
    } else if (this.isMacOS) {
      return 'open';
    } else {
      return 'xdg-open';
    }
  }

  /**
   * Get system username
   */
  static getUsername() {
    return process.env.USERNAME || process.env.USER || 'unknown';
  }

  /**
   * Get hostname
   */
  static getHostname() {
    return process.env.COMPUTERNAME || process.env.HOSTNAME || 'localhost';
  }
}
