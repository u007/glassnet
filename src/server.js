/**
 * GlassNet - Network Monitoring Server
 * Main server entry point
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createServer } from 'http';
import { Platform } from './utils/platform.js';
import { DatabaseManager } from './database/db.js';
import { NetworkMonitor } from './monitors/network-monitor.js';
import { APIRoutes } from './api/routes.js';
import { WebSocketManager } from './api/websocket.js';

class GlassNetServer {
  constructor() {
    this.config = this.loadConfig();
    this.db = null;
    this.monitor = null;
    this.server = null;
    this.api = null;
    this.ws = null;
    this.cleanupInterval = null;
  }

  /**
   * Load configuration
   */
  loadConfig() {
    try {
      const configPath = join(process.cwd(), 'config.json');
      if (existsSync(configPath)) {
        const configData = readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn('Could not load config file, using defaults:', error.message);
    }

    // Default configuration
    return {
      monitoring: {
        interval: 5000,
        protocols: ['tcp', 'udp'],
        includeLoopback: false
      },
      database: {
        retentionDays: 3,
        cleanupInterval: 'daily'
      },
      server: {
        port: 3000,
        autoLaunchBrowser: true
      },
      privacy: {
        resolveHostnames: true,
        logProcessArgs: false
      }
    };
  }

  /**
   * Initialize all components
   */
  async init() {
    console.log('🔍 Starting GlassNet Network Monitor...');
    console.log('Platform:', Platform.current);
    console.log('Hostname:', Platform.getHostname());
    console.log('User:', Platform.getUsername());

    // Check privileges
    const hasPrivileges = await Platform.checkPrivileges();
    if (!hasPrivileges) {
      console.warn('⚠️  Running without elevated privileges. Some process information may be limited.');
    }

    // Initialize database
    console.log('📊 Initializing database...');
    this.db = new DatabaseManager();

    // Initialize network monitor
    console.log('🔌 Initializing network monitor...');
    this.monitor = new NetworkMonitor(this.db, this.config);

    // Initialize API
    this.api = new APIRoutes(this.db, this.monitor);

    // Create HTTP server
    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Initialize WebSocket
    this.ws = new WebSocketManager(this.server, this.monitor);
    this.ws.startHeartbeat();

    // Set up cleanup intervals
    this.setupCleanupTasks();

    console.log('✅ All components initialized');
  }

  /**
   * Handle HTTP requests
   */
  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    try {
      // API routes
      if (pathname.startsWith('/api/')) {
        const fullUrl = `http://${req.headers.host}${req.url}`;
        const request = new Request(fullUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined
        });

        const response = await this.api.handleRequest(request, url);
        
        // Convert Response to Node.js response
        res.statusCode = response.status;
        
        for (const [key, value] of response.headers.entries()) {
          res.setHeader(key, value);
        }

        const body = await response.text();
        res.end(body);
        return;
      }

      // Static file serving
      await this.serveStaticFile(req, res, pathname);

    } catch (error) {
      console.error('Request handling error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Serve static files
   */
  async serveStaticFile(req, res, pathname) {
    // Default to index.html for root
    if (pathname === '/') {
      pathname = '/index.html';
    }

    const filePath = join(process.cwd(), 'public', pathname);
    
    try {
      if (!existsSync(filePath)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>404 - Not Found</title></head>
            <body>
              <h1>404 - File Not Found</h1>
              <p>The requested file <code>${pathname}</code> was not found.</p>
              <p><a href="/">Go to Dashboard</a></p>
            </body>
          </html>
        `);
        return;
      }

      const fileContent = readFileSync(filePath);
      const contentType = this.getContentType(pathname);
      
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache'); // Always serve fresh content during development
      res.end(fileContent);

    } catch (error) {
      console.error('Error serving file:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal Server Error');
    }
  }

  /**
   * Get content type based on file extension
   */
  getContentType(pathname) {
    const ext = pathname.split('.').pop().toLowerCase();
    
    const contentTypes = {
      'html': 'text/html; charset=utf-8',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon'
    };

    return contentTypes[ext] || 'text/plain';
  }

  /**
   * Setup cleanup tasks
   */
  setupCleanupTasks() {
    // Daily cleanup of old records
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    this.cleanupInterval = setInterval(() => {
      console.log('🧹 Running daily cleanup...');
      const deletedCount = this.db.cleanOldRecords(this.config.database.retentionDays);
      console.log(`Cleaned up ${deletedCount} old records`);
      
      // Also vacuum the database weekly (every 7 days)
      const now = new Date();
      if (now.getDay() === 0) { // Sunday
        this.db.vacuum();
      }
    }, cleanupInterval);

    // Initial cleanup on startup
    setTimeout(() => {
      const deletedCount = this.db.cleanOldRecords(this.config.database.retentionDays);
      if (deletedCount > 0) {
        console.log(`Initial cleanup: removed ${deletedCount} old records`);
      }
    }, 5000);
  }

  /**
   * Start the server
   */
  async start() {
    await this.init();

    const port = this.config.server.port;

    this.server.listen(port, () => {
      console.log(`🚀 GlassNet server running on http://localhost:${port}`);
      console.log(`📊 Dashboard: http://localhost:${port}`);
      console.log(`🔌 WebSocket: ws://localhost:${port}/ws`);
      
      // Auto-launch browser if configured
      if (this.config.server.autoLaunchBrowser) {
        this.launchBrowser(`http://localhost:${port}`);
      }
    });

    // Start network monitoring
    await this.monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Launch browser
   */
  async launchBrowser(url) {
    try {
      const command = Platform.getBrowserCommand();
      console.log(`🌐 Launching browser: ${command} ${url}`);
      
      const result = await Bun.spawn([command, url], {
        stdout: 'ignore',
        stderr: 'ignore'
      });

      // Don't wait for the browser process
      result.unref?.();
    } catch (error) {
      console.warn('Failed to launch browser automatically:', error.message);
      console.log(`Please open your browser manually and navigate to: ${url}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('\n🛑 Shutting down GlassNet...');

    // Stop monitoring
    if (this.monitor) {
      this.monitor.stop();
    }

    // Stop cleanup intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close WebSocket server
    if (this.ws) {
      this.ws.close();
    }

    // Close HTTP server
    if (this.server) {
      this.server.close();
    }

    // Close database
    if (this.db) {
      this.db.close();
    }

    console.log('✅ Shutdown complete');
    process.exit(0);
  }
}

// Start the server
const app = new GlassNetServer();
app.start().catch(error => {
  console.error('❌ Failed to start GlassNet:', error);
  process.exit(1);
});
