# GlassNet - Network Monitoring Application

GlassNet is a cross-platform network monitoring application built with Bun.js that captures and logs network requests, displaying process information, user details, and destination information in a real-time web-based interface.

## Features

- 🔍 **Real-time Network Monitoring**: Live capture of TCP/UDP connections
- 📊 **Process Information**: Maps connections to running processes and users
- 🌐 **Hostname Resolution**: Resolves IP addresses to hostnames
- 💾 **SQLite Database**: Local storage with automatic cleanup
- 🖥️ **Web Dashboard**: Real-time web interface with filtering
- 📱 **Responsive Design**: Works on desktop and mobile browsers
- 🔄 **Auto-refresh**: Real-time updates via WebSocket
- 🗂️ **Historical Data**: Browse past network activity
- 🧹 **Automatic Cleanup**: Configurable data retention (default: 3 days)
- 🌍 **Cross-platform**: Supports Windows, macOS, and Linux

## Requirements

- [Bun.js](https://bun.sh/) (version 1.0+)
- Administrator/root privileges (recommended for complete process information)

## Installation

1. Clone or download the project:
   ```bash
   git clone <repository-url>
   cd glassnet
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run the application:
   ```bash
   bun start
   ```

4. Open your browser to `http://localhost:3000` (should open automatically)

## Usage

### Dashboard
- View live network connections in real-time
- Filter by protocol (TCP/UDP), process name, or connection state
- See statistics including total connections and active processes

### History
- Browse historical connection data
- Filter by time range and process
- Export data to CSV format

### Settings
- View monitoring configuration
- Manage database (cleanup old records, clear all data)
- See system information and connection status

## Configuration

Edit `config.json` to customize behavior:

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

## Building Standalone Executables

Build for current platform:
```bash
bun run build
```

Build for all platforms:
```bash
bun run build-win    # Windows
bun run build-mac    # macOS
bun run build-linux  # Linux
```

The executables will be created in the project root directory.

## Platform-specific Notes

### Windows
- May require administrator privileges for complete process information
- Uses `netstat -ano` and PowerShell commands for process detection

### macOS
- Uses `lsof -i` and `netstat -anv` for network monitoring
- May require granting Terminal full disk access for complete process info

### Linux
- Uses `ss -tulpn` or `netstat -tulpn` for network connections
- Requires `sudo` for some advanced process information

## API Endpoints

The application provides a REST API:

- `GET /api/connections` - Current connections
- `GET /api/connections/history` - Historical data
- `GET /api/stats` - Statistics
- `GET /api/processes` - Process list
- `DELETE /api/connections/cleanup` - Clean old records

WebSocket endpoint: `ws://localhost:3000/ws`

## Security Considerations

- All data is stored locally in SQLite database
- No external network communication except for hostname resolution
- Hostname resolution can be disabled in configuration
- Application requires elevated privileges for complete process information

## Troubleshooting

### Permission Issues
- Run with administrator/sudo privileges for complete process information
- On macOS, grant Terminal app "Full Disk Access" in System Preferences

### Network Monitoring Not Working
- Ensure the application has necessary permissions
- Check if antivirus software is blocking network monitoring tools
- Verify that `netstat`, `lsof`, or `ss` commands are available

### Browser Not Opening
- Check if default browser is properly configured
- Manually navigate to `http://localhost:3000`
- Check firewall settings for port 3000

## Development

### Project Structure
```
glassnet/
├── src/
│   ├── server.js           # Main server entry point
│   ├── monitors/           # Network monitoring logic
│   ├── database/           # SQLite database management
│   ├── utils/              # Utility functions
│   └── api/                # REST API and WebSocket
├── public/                 # Web interface files
│   ├── index.html
│   ├── css/
│   └── js/
├── config.json             # Configuration file
└── package.json
```

### Running in Development Mode
```bash
bun run dev  # Runs with auto-reload on file changes
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the configuration options
3. Open an issue on the project repository
