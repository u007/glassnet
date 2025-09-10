# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GlassNet is a cross-platform network monitoring application built with Bun.js that captures and logs network requests, displaying process information, user details, and destination information in a real-time web-based interface.

## Development Commands

### Essential Commands
```bash
# Install dependencies
bun install

# Start development server (with auto-reload)
bun run dev

# Start production server
bun start

# Run tests
bun test

# Build standalone executables
bun run build              # Current platform
bun run build-win          # Windows
bun run build-mac          # macOS
bun run build-linux        # Linux
```

### Testing
```bash
# Run all tests
bun test

# Run specific test file
bun test path/to/test.test.js
```

## Architecture Overview

### Core Components

**Server Architecture:**
- `src/server.js` - Main server entry point, orchestrates all components
- `src/monitors/network-monitor.js` - Core network monitoring logic using platform-specific commands
- `src/database/db.js` - SQLite database management with automatic cleanup
- `src/api/routes.js` - REST API endpoints for data access
- `src/api/websocket.js` - Real-time WebSocket communication

**Platform Utilities:**
- `src/utils/platform.js` - Cross-platform detection and utilities
- `src/utils/process-utils.js` - Process identification and user mapping
- `src/utils/dns-resolver.js` - Hostname resolution with caching

**Frontend Architecture:**
- `public/index.html` - Main dashboard interface
- `public/js/app.js` - Main application logic and state management
- `public/js/components/` - Modular UI components (dashboard, history, settings)
- `public/js/websocket.js` - WebSocket client for real-time updates

### Key Design Patterns

**Platform Abstraction:** Network monitoring uses different system commands per platform:
- Windows: `netstat -ano` + PowerShell for process info
- macOS: `lsof -i` + `netstat -anv` 
- Linux: `ss -tulpn` or `netstat -tulpn`

**Real-time Architecture:** WebSocket connections push live updates to clients with intelligent change detection to avoid redundant data transmission.

**Data Management:** SQLite database with automatic retention policy (default 3 days), proper indexing, and background cleanup processes.

### Database Schema

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
```

## Configuration

Configuration is loaded from `config.json` with sensible defaults:

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

## API Endpoints

### REST API
- `GET /api/connections` - Current connections
- `GET /api/connections/history` - Historical data with pagination
- `GET /api/stats` - Monitoring statistics
- `GET /api/processes` - Unique process list for filtering
- `DELETE /api/connections/cleanup` - Clean old records

### WebSocket
- `/ws` - Real-time connection updates

## Development Notes

### File Structure Conventions
- All source code uses ES modules (import/export)
- Platform-specific code is abstracted in utils/ directory
- Frontend components are modularized in public/js/components/
- Database operations are centralized in database/db.js

### Security Considerations
- Requires elevated privileges for complete process information
- All data stored locally in SQLite (no external transmissions)
- Hostname resolution can be disabled via configuration
- Application logs are separate from network monitoring logs

### Cross-Platform Development
- Test on all target platforms (Windows, macOS, Linux)
- Platform detection handles fallbacks gracefully
- Process identification varies by platform capabilities
- Build scripts target specific platforms for standalone executables

### Performance Considerations
- Configurable monitoring intervals (default 5 seconds)
- Intelligent change detection reduces database writes
- Database indexing optimized for common queries
- Background cleanup prevents database bloat
- WebSocket updates are batched for efficiency