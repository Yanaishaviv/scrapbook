# Scrapbook Plugin for Obsidian

A comprehensive research documentation tool with integrated task management and REST API for seamless workflow integration.

## Features

### 📝 Question Management
- **Smart Queue System**: Questions are automatically sorted by importance (High > Medium > Low)
- **Time Tracking**: Automatic time tracking with overtime alerts when exceeding estimated time by 40%
- **Persistent State**: Current question and progress survive Obsidian restarts
- **Thinking Mode**: Automatic 8-minute thinking breaks every hour

### 📊 Documentation Integration
- **File Management**: Add text and images to existing or new documentation files
- **Image Handling**: Automatic image storage in attachments folder with proper linking
- **File Discovery**: API endpoint to list all vault files for easy selection

### 🔌 REST API
Complete REST API for external tool integration:

#### Inbound Endpoints (Plugin receives)
- `GET /api/question/complete` - Mark current question as completed
- `GET /api/break/start` - Start a break (pause timers)
- `GET /api/break/end` - End break (resume timers)
- `GET /api/files` - Get list of all vault files
- `POST /api/question/add` - Add new question to queue
- `POST /api/docs/add` - Add text/image to documentation

#### Outbound Notifications (Plugin sends)
- `POST {frontend_url}/current-question` - New active question started
- `POST {frontend_url}/overtime-alert` - Time limit exceeded warning
- `POST {frontend_url}/thinking-mode` - Thinking mode activated

## Installation

1. Download the release files
2. Create folder `.obsidian/plugins/scrapbook/` in your vault
3. Copy `main.js`, `manifest.json`, and `styles.css` to the plugin folder
4. Enable the plugin in Obsidian Settings > Community Plugins

## Configuration

The plugin creates a `questions.md` file in your vault root with the following structure:

```markdown
# Questions Queue
## Active
- [ ] **Current Question Title**
- Importance: High
- Estimated: 2h
- Started: 2025-06-19 10:30
- Time Spent: 1h 23m
## Pending
- [ ] **Next Question** (Importance: Medium, Estimated: 1h)
- [ ] **Another Question** (Importance: Low, Estimated: 30m)
## Completed
- [x] **Previous Question** (Time Spent: 45m/1h)
```

### Settings

The plugin automatically creates a settings file with these defaults:
- **API Port**: 8080
- **Frontend URL**: http://localhost:5000
- **Questions File**: questions.md (in vault root)

## API Usage Examples

### Adding a Question
```bash
curl -X POST http://localhost:8080/api/question/add \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Research authentication methods",
    "importance": "High",
    "estimatedTime": 120
  }'
```

### Adding Documentation
```bash
curl -X POST http://localhost:8080/api/docs/add \
  -H "Content-Type: application/json" \
  -d '{
    "targetFile": "research/auth-notes.md",
    "text": "OAuth 2.0 provides better security than basic auth...",
    "image": {
      "data": "base64-encoded-image-data",
      "filename": "oauth-flow.png"
    }
  }'
```

### Getting Vault Files
```bash
curl http://localhost:8080/api/files
```

### Completing Current Question
```bash
curl -X POST http://localhost:8080/api/question/complete
```

## PyQt6 Integration Example

Here's a simple example of how your PyQt6 frontend might interact with the plugin:

```python
import requests
import json
from PyQt6.QtWidgets import QApplication, QMainWindow, QLabel, QPushButton, QVBoxLayout, QWidget
from PyQt6.QtCore import QTimer
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

class ScrapbookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        if self.path == '/current-question':
            # Update UI with new question
            main_window.update_current_question(data['question'])
        elif self.path == '/overtime-alert':
            # Show overtime warning
            main_window.show_overtime_alert(data)
        elif self.path == '/thinking-mode':
            # Show thinking mode notification
            main_window.start_thinking_mode()
        
        self.send_response(200)
        self.end_headers()

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.init_ui()
        
    def init_ui(self):
        self.setWindowTitle("Scrapbook Frontend")
        central_widget = QWidget()
        layout = QVBoxLayout()
        
        self.question_label = QLabel("No active question")
        self.complete_button = QPushButton("Complete Question")
        self.break_button = QPushButton("Take Break")
        
        self.complete_button.clicked.connect(self.complete_question)
        self.break_button.clicked.connect(self.toggle_break)
        
        layout.addWidget(self.question_label)
        layout.addWidget(self.complete_button)
        layout.addWidget(self.break_button)
        
        central_widget.setLayout(layout)
        self.setCentralWidget(central_widget)
        
    def update_current_question(self, question):
        self.question_label.setText(f"Current: {question['title']}")
        
    def complete_question(self):
        requests.post('http://localhost:8080/api/question/complete')
        
    def toggle_break(self):
        # Toggle break state
        if self.break_button.text() == "Take Break":
            requests.post('http://localhost:8080/api/break/start')
            self.break_button.setText("End Break")
        else:
            requests.post('http://localhost:8080/api/break/end')
            self.break_button.setText("Take Break")

# Start HTTP server for receiving notifications
server = HTTPServer(('localhost', 5000), ScrapbookHandler)
server_thread = threading.Thread(target=server.serve_forever)
server_thread.daemon = True
server_thread.start()

app = QApplication([])
main_window = MainWindow()
main_window.show()
app.exec()
```

## Features in Detail

### Time Management
- **Automatic Tracking**: Time starts when a question becomes active
- **Break Handling**: Pauses timers during breaks
- **Overtime Alerts**: Notifications when exceeding estimated time by 40%
- **Thinking Breaks**: Mandatory 8-minute reflection periods every hour

### File Operations
- **Smart File Creation**: Creates files if they don't exist
- **Content Appending**: Adds new content to existing files at the bottom
- **Image Management**: Stores images in `attachments/` folder with proper Obsidian linking
- **Markdown Integration**: Full support for Obsidian's markdown features

### Cross-Platform Compatibility
- **Windows**: Full support with proper path handling
- **Linux**: Native support for all features
- **macOS**: Compatible (though not specifically tested)

## Development

### Building from Source
```bash
npm install
npm run build
```

### Development Mode
```bash
npm run dev
```

### Project Structure
```
scrapbook/
├── main.ts              # Main plugin code
├── manifest.json        # Plugin manifest
├── package.json         # Node.js dependencies
├── tsconfig.json        # TypeScript configuration
├── esbuild.config.mjs   # Build configuration
└── README.md           # This file
```

## Troubleshooting

### Common Issues

**Plugin not loading**
- Check that all files are in the correct directory
- Verify the plugin is enabled in Obsidian settings
- Check the console for error messages

**API not responding**
- Confirm the port (default 8080) isn't in use by another application
- Check firewall settings
- Verify the frontend URL is correctly configured

**Questions file not updating**
- Ensure you have write permissions to your vault
- Check that the questions.md file isn't open in another application
- Verify the file isn't corrupted

**Timers not working**
- Check that a question is currently active
- Verify you're not in break mode
- Restart Obsidian if timers seem stuck

### Debug Mode
Enable debug logging by opening the developer console (Ctrl/Cmd + Shift + I) and looking for "Scrapbook" messages.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues, feature requests, or questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [repository-url]/wiki