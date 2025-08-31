# GlassNet - Network Monitoring Application

## Project Overview
A cross-platform network monitoring application built with Bun.js that captures and logs network requests, displaying process information, user details, and destination information in a web-based UI.

## Core Features

### 1. Network Monitoring
- **Real-time packet capture**: Monitor TCP/UDP connections
- **Process identification**: Map network connections to running processes
- **User identification**: Identify which user initiated the connection
- **Destination analysis**: Resolve hostnames and show IP addresses with ports
- **Protocol detection**: Distinguish between TCP and UDP traffic

### 2. Data Storage
- **SQLite database**: Local storage for network logs
- **Automatic cleanup**: Keep only last 3 days of logs
- **Schema design**: Efficient storage with proper indexing
- **Data retention**: Configurable retention period

### 3. Web Interface
- **Real-time dashboard**: Live view of network connections
- **Historical logs**: Browse past network activity
- **Filtering options**: Filter by process, user, protocol, etc.
- **Manual cleanup**: UI option to clear old logs
- **Responsive design**: Works on desktop and mobile browsers

### 4. Cross-Platform Support
- **Windows**: Use netstat/PowerShell commands
- **macOS**: Use netstat/lsof commands  
- **Linux**: Use netstat/ss/lsof commands
- **Process detection**: Platform-specific process identification

## Technical Architecture

### Backend (Bun.js)
```
src/
├── server.js              # Main server entry point
├── monitors/
│   ├── network-monitor.js  # Core network monitoring logic
│   ├── windows-monitor.js  # Windows-specific implementation
│   ├── macos-monitor.js    # macOS-specific implementation
│   └── linux-monitor.js   # Linux-specific implementation
├── database/
│   ├── db.js              # SQLite database setup
│   ├── models.js          # Database models/schemas
│   └── migrations.js      # Database migrations
├── utils/
│   ├── platform.js       # Platform detection utilities
│   ├── process-utils.js   # Process identification helpers
│   └── dns-resolver.js    # Hostname resolution
└── api/
    ├── routes.js          # API endpoints
    └── websocket.js       # Real-time data streaming
```

### Frontend
```
public/
├── index.html             # Main dashboard
├── css/
│   └── styles.css         # Application styles
├── js/
│   ├── app.js            # Main application logic
│   ├── websocket.js      # WebSocket client
│   └── components/
│       ├── dashboard.js   # Live monitoring view
│       ├── history.js     # Historical logs view
│       └── settings.js    # Settings and cleanup
└── assets/
    └── icons/             # UI icons and images
```

## Database Schema

### connections table
```sql
CREATE TABLE connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    process_name TEXT NOT NULL,
    process_id INTEGER,
    user_name TEXT,
    protocol TEXT NOT NULL, -- TCP/UDP
    local_address TEXT,
    local_port INTEGER,
    remote_address TEXT,
    remote_port INTEGER,
    remote_hostname TEXT,
    state TEXT, -- ESTABLISHED, LISTEN, etc.
    bytes_sent INTEGER DEFAULT 0,
    bytes_received INTEGER DEFAULT 0
);

CREATE INDEX idx_timestamp ON connections(timestamp);
CREATE INDEX idx_process_name ON connections(process_name);
CREATE INDEX idx_remote_address ON connections(remote_address);
```

## Platform-Specific Implementation

### Windows
- **Commands**: `netstat -ano`, `tasklist`, PowerShell Get-Process
- **Process mapping**: Use PID from netstat to match with process list
- **User identification**: PowerShell Get-WmiObject Win32_Process

### macOS  
- **Commands**: `netstat -anv`, `lsof -i`, `ps aux`
- **Process mapping**: Cross-reference netstat output with lsof
- **User identification**: Parse ps aux output

### Linux
- **Commands**: `ss -tuln`, `netstat -tulpn`, `lsof -i`, `ps aux`
- **Process mapping**: Use ss/netstat with process info
- **User identification**: Parse ps output or /proc filesystem

## API Endpoints

### REST API
- `GET /api/connections` - Get current connections
- `GET /api/connections/history` - Get historical data with pagination
- `DELETE /api/connections/cleanup` - Clear old logs
- `GET /api/stats` - Get monitoring statistics
- `GET /api/processes` - Get unique process list for filtering

### WebSocket
- `/ws` - Real-time connection updates

## Development Phases

### Phase 1: Core Infrastructure (Week 1)
- [x] Set up Bun.js project structure
- [ ] Implement SQLite database setup
- [ ] Create basic web server
- [ ] Platform detection utilities

### Phase 2: Network Monitoring (Week 2)
- [ ] Implement cross-platform network monitoring
- [ ] Process identification and mapping
- [ ] Database integration for logging
- [ ] Basic API endpoints

### Phase 3: Web Interface (Week 3)
- [ ] Create dashboard HTML/CSS
- [ ] Implement real-time updates via WebSocket
- [ ] Historical data viewing
- [ ] Filtering and search functionality

### Phase 4: Polish & Deployment (Week 4)
- [ ] Error handling and logging
- [ ] Performance optimization
- [ ] Build standalone executable
- [ ] Auto-browser launching
- [ ] Testing on all platforms

## Deployment Strategy

### Standalone Executable
```bash
# Build for current platform
bun build --compile --outfile glassnet src/server.js

# Cross-platform builds
bun build --compile --target=windows-x64 --outfile glassnet.exe src/server.js
bun build --compile --target=darwin-x64 --outfile glassnet-mac src/server.js
bun build --compile --target=linux-x64 --outfile glassnet-linux src/server.js
```

### Auto-start Browser
- Detect available browsers on each platform
- Launch default browser pointing to localhost:3000
- Provide fallback URL for manual access

## Security Considerations

### Permissions
- **Windows**: May require administrator privileges for full process info
- **macOS**: May need to grant terminal app full disk access
- **Linux**: May require sudo for some network monitoring features

### Data Privacy
- All data stored locally in SQLite
- No external network communication except for hostname resolution
- Option to disable hostname resolution for privacy

## Performance Optimization

### Monitoring Efficiency
- Configurable polling intervals (default: 5 seconds)
- Intelligent change detection to avoid redundant logging
- Connection state tracking to detect new/closed connections

### Database Optimization
- Proper indexing for fast queries
- Batch inserts for performance
- Background cleanup jobs
- Connection pooling

## Configuration Options

### Settings File (config.json)
```json
{
  "monitoring": {
    "interval": 5000,
    "protocols": ["tcp", "udp"],
    "includeLoopback": false
  },
  "database": {
    "retentionDays": 3,
    "cleanupInterval": "daily"
  },
  "server": {
    "port": 3000,
    "autoLaunchBrowser": true
  },
  "privacy": {
    "resolveHostnames": true,
    "logProcessArgs": false
  }
}
```

## Error Handling

### Graceful Degradation
- Fall back to basic netstat if advanced tools unavailable
- Continue monitoring even if some process info unavailable
- Handle permission denied errors gracefully

### Logging
- Application logs separate from network logs
- Configurable log levels
- Rotation and cleanup of application logs

## Testing Strategy

### Unit Tests
- Platform detection utilities
- Database operations
- Network parsing functions

### Integration Tests
- End-to-end monitoring flow
- Cross-platform compatibility
- Performance under load

### Manual Testing
- Test on Windows 10/11
- Test on macOS (Intel and Apple Silicon)
- Test on Ubuntu/Debian/CentOS Linux

## Future Enhancements

### Advanced Features
- Network usage graphs and charts
- Export data to CSV/JSON
- Alert system for suspicious connections
- Geolocation mapping of remote IPs
- Process reputation checking

### UI Improvements
- Dark/light theme toggle
- Customizable dashboard layouts
- Advanced filtering options
- Real-time charts and graphs

This plan provides a comprehensive roadmap for building GlassNet, a powerful cross-platform network monitoring tool that will help users understand their system's network activity in real-time.
