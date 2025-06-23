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
        print(f"Received POST request on {self.path} with data: {data}")
        if self.path == '/current-question':
            # Update UI with new question
            print("Received current question update:", data)
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
        print("Completing question...")
        requests.get('http://localhost:8080/api/question/complete')
        
    def toggle_break(self):
        # Toggle break state
        if self.break_button.text() == "Take Break":
            requests.get('http://localhost:8080/api/break/start')
            self.break_button.setText("End Break")
        else:
            requests.get('http://localhost:8080/api/break/end')
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
