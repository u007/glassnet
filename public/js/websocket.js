/**
 * WebSocket client for real-time communication
 */

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.listeners = new Map();
    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
      this.emit('connected');

      // Subscribe to updates
      this.send({
        type: 'subscribe',
        subscriptions: ['connections', 'status']
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      this.isConnecting = false;
      this.updateConnectionStatus('disconnected');
      this.emit('disconnected');
      
      // Attempt to reconnect
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
      this.updateConnectionStatus('disconnected');
      this.emit('error', error);
    };
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    console.log('WebSocket message:', message.type);

    switch (message.type) {
      case 'connections':
        this.emit('connections', message.data);
        break;
      case 'status':
        this.emit('status', message.data);
        break;
      case 'heartbeat':
        this.emit('heartbeat', message);
        break;
      case 'pong':
        this.emit('pong', message);
        break;
      case 'subscribed':
        console.log('Subscribed to:', message.subscriptions);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.updateConnectionStatus('disconnected');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);
    
    this.updateConnectionStatus('connecting');
    
    setTimeout(() => {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }, this.reconnectInterval);
  }

  /**
   * Update connection status in UI
   */
  updateConnectionStatus(status) {
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');

    if (statusIcon && statusText) {
      statusIcon.className = `status-icon ${status}`;
      
      switch (status) {
        case 'connected':
          statusIcon.textContent = '🟢';
          statusText.textContent = 'Connected';
          break;
        case 'connecting':
          statusIcon.textContent = '🟡';
          statusText.textContent = 'Connecting...';
          break;
        case 'disconnected':
          statusIcon.textContent = '🔴';
          statusText.textContent = 'Disconnected';
          break;
      }
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      }
    }
  }

  /**
   * Send ping to server
   */
  ping() {
    this.send({ type: 'ping', timestamp: Date.now() });
  }

  /**
   * Request status update from server
   */
  requestStatus() {
    this.send({ type: 'requestStatus' });
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get current connection state
   */
  getReadyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Global WebSocket client instance
window.wsClient = new WebSocketClient();
