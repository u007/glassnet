/**
 * WebSocket server for real-time updates
 */

import { WebSocketServer } from 'ws';

export class WebSocketManager {
  constructor(server, monitor) {
    this.server = server;
    this.monitor = monitor;
    this.wss = null;
    this.clients = new Set();
    this.init();
  }

  /**
   * Initialize WebSocket server
   */
  init() {
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, request) => {
      console.log('New WebSocket connection from:', request.socket.remoteAddress);
      
      this.clients.add(ws);

      // Send initial status
      this.sendToClient(ws, {
        type: 'status',
        data: this.monitor.getStatus()
      });

      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    // Listen to monitor for new connections
    this.monitor.addListener((connections) => {
      this.broadcastConnections(connections);
    });

    console.log('WebSocket server initialized');
  }

  /**
   * Handle messages from clients
   */
  handleClientMessage(ws, message) {
    switch (message.type) {
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
        
      case 'subscribe':
        // Client wants to subscribe to specific updates
        ws.subscriptions = message.subscriptions || ['connections', 'status'];
        this.sendToClient(ws, { type: 'subscribed', subscriptions: ws.subscriptions });
        break;
        
      case 'requestStatus':
        this.sendToClient(ws, {
          type: 'status',
          data: this.monitor.getStatus()
        });
        break;
        
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Error broadcasting message:', error);
          this.clients.delete(client);
        }
      }
    }
  }

  /**
   * Broadcast new connections to clients
   */
  broadcastConnections(connections) {
    if (connections.length === 0) return;

    const message = {
      type: 'connections',
      data: connections,
      timestamp: Date.now()
    };

    this.broadcast(message);
  }

  /**
   * Broadcast status updates
   */
  broadcastStatus(status) {
    const message = {
      type: 'status',
      data: status,
      timestamp: Date.now()
    };

    this.broadcast(message);
  }

  /**
   * Send periodic heartbeat to maintain connections
   */
  startHeartbeat() {
    setInterval(() => {
      const message = {
        type: 'heartbeat',
        timestamp: Date.now(),
        clientCount: this.clients.size
      };

      this.broadcast(message);
    }, 30000); // Every 30 seconds
  }

  /**
   * Get WebSocket statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      isRunning: this.wss !== null
    };
  }

  /**
   * Close WebSocket server
   */
  close() {
    if (this.wss) {
      console.log('Closing WebSocket server...');
      this.wss.close();
      this.wss = null;
    }
  }
}
