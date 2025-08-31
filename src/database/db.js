/**
 * SQLite database setup and connection management
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export class DatabaseManager {
  constructor(dbPath = './data/glassnet.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.ensureDataDirectory();
    this.connect();
    this.initializeSchema();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Connect to SQLite database
   */
  connect() {
    try {
      this.db = new Database(this.dbPath);
      console.log('Connected to SQLite database:', this.dbPath);
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  initializeSchema() {
    const createConnectionsTable = `
      CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        process_name TEXT NOT NULL,
        process_id INTEGER,
        user_name TEXT,
        protocol TEXT NOT NULL,
        local_address TEXT,
        local_port INTEGER,
        remote_address TEXT,
        remote_port INTEGER,
        remote_hostname TEXT,
        state TEXT,
        bytes_sent INTEGER DEFAULT 0,
        bytes_received INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_connections_timestamp ON connections(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_connections_process_name ON connections(process_name)',
      'CREATE INDEX IF NOT EXISTS idx_connections_remote_address ON connections(remote_address)',
      'CREATE INDEX IF NOT EXISTS idx_connections_protocol ON connections(protocol)',
      'CREATE INDEX IF NOT EXISTS idx_connections_state ON connections(state)',
      'CREATE INDEX IF NOT EXISTS idx_connections_created_at ON connections(created_at)'
    ];

    try {
      this.db.run(createConnectionsTable);
      
      for (const indexQuery of createIndexes) {
        this.db.run(indexQuery);
      }

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Insert a new connection record
   */
  insertConnection(connectionData) {
    const insertQuery = `
      INSERT INTO connections (
        process_name, process_id, user_name, protocol,
        local_address, local_port, remote_address, remote_port,
        remote_hostname, state, bytes_sent, bytes_received
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const stmt = this.db.prepare(insertQuery);
      const result = stmt.run(
        connectionData.processName,
        connectionData.processId,
        connectionData.userName,
        connectionData.protocol,
        connectionData.localAddress,
        connectionData.localPort,
        connectionData.remoteAddress,
        connectionData.remotePort,
        connectionData.remoteHostname,
        connectionData.state,
        connectionData.bytesSent || 0,
        connectionData.bytesReceived || 0
      );

      return result.lastInsertRowid;
    } catch (error) {
      console.error('Failed to insert connection:', error);
      throw error;
    }
  }

  /**
   * Get recent connections with pagination
   */
  getConnections(limit = 100, offset = 0, filters = {}) {
    let query = `
      SELECT * FROM connections 
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (filters.processName) {
      query += ' AND process_name LIKE ?';
      params.push(`%${filters.processName}%`);
    }

    if (filters.protocol) {
      query += ' AND protocol = ?';
      params.push(filters.protocol);
    }

    if (filters.remoteAddress) {
      query += ' AND remote_address = ?';
      params.push(filters.remoteAddress);
    }

    if (filters.state) {
      query += ' AND state = ?';
      params.push(filters.state);
    }

    if (filters.since) {
      query += ' AND timestamp >= ?';
      params.push(filters.since);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      console.error('Failed to get connections:', error);
      return [];
    }
  }

  /**
   * Get unique processes
   */
  getUniqueProcesses() {
    const query = `
      SELECT DISTINCT process_name, COUNT(*) as count
      FROM connections 
      WHERE timestamp >= datetime('now', '-1 day')
      GROUP BY process_name 
      ORDER BY count DESC
    `;

    try {
      const stmt = this.db.prepare(query);
      return stmt.all();
    } catch (error) {
      console.error('Failed to get unique processes:', error);
      return [];
    }
  }

  /**
   * Get connection statistics
   */
  getStatistics() {
    const queries = {
      totalConnections: 'SELECT COUNT(*) as count FROM connections',
      connectionsToday: 'SELECT COUNT(*) as count FROM connections WHERE DATE(timestamp) = DATE("now")',
      uniqueProcessesToday: 'SELECT COUNT(DISTINCT process_name) as count FROM connections WHERE DATE(timestamp) = DATE("now")',
      protocolBreakdown: `
        SELECT protocol, COUNT(*) as count 
        FROM connections 
        WHERE timestamp >= datetime('now', '-1 day')
        GROUP BY protocol
      `,
      topProcesses: `
        SELECT process_name, COUNT(*) as count 
        FROM connections 
        WHERE timestamp >= datetime('now', '-1 day')
        GROUP BY process_name 
        ORDER BY count DESC 
        LIMIT 10
      `
    };

    const stats = {};

    try {
      for (const [key, query] of Object.entries(queries)) {
        const stmt = this.db.prepare(query);
        if (key === 'protocolBreakdown' || key === 'topProcesses') {
          stats[key] = stmt.all();
        } else {
          const result = stmt.get();
          stats[key] = result?.count || 0;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {};
    }
  }

  /**
   * Clean old records based on retention policy
   */
  cleanOldRecords(retentionDays = 3) {
    const query = `
      DELETE FROM connections 
      WHERE timestamp < datetime('now', '-${retentionDays} days')
    `;

    try {
      const stmt = this.db.prepare(query);
      const result = stmt.run();
      console.log(`Cleaned ${result.changes} old records older than ${retentionDays} days`);
      return result.changes;
    } catch (error) {
      console.error('Failed to clean old records:', error);
      return 0;
    }
  }

  /**
   * Manually clear all logs
   */
  clearAllLogs() {
    const query = 'DELETE FROM connections';

    try {
      const stmt = this.db.prepare(query);
      const result = stmt.run();
      console.log(`Cleared all ${result.changes} connection records`);
      return result.changes;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return 0;
    }
  }

  /**
   * Get database file size
   */
  getDatabaseSize() {
    try {
      const fs = require('fs');
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch (error) {
      console.error('Failed to get database size:', error);
      return 0;
    }
  }

  /**
   * Vacuum database to reclaim space
   */
  vacuum() {
    try {
      this.db.run('VACUUM');
      console.log('Database vacuumed successfully');
    } catch (error) {
      console.error('Failed to vacuum database:', error);
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }
}
