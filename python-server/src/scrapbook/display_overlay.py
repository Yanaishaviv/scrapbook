import sys
import threading
from flask import Flask, request, jsonify
from PyQt6.QtWidgets import QApplication, QWidget, QLineEdit, QVBoxLayout
from PyQt6.QtGui import QFontMetrics, QMouseEvent
from PyQt6.QtCore import Qt, pyqtSignal, QObject

# === Constants ===

MIN_WIDTH = 100
PADDING = 40  # Extra space for padding and cursor
WINDOW_HEIGHT = 50

STYLE_SHEET = """
    QLineEdit {
        background-color: rgba(30, 30, 30, 220);
        color: white;
        padding: 10px;
        font-size: 18px;
        border-radius: 8px;
        border: 2px solid #444;
    }
"""

PLACEHOLDER_TEXT = "Waiting for question..."

# === Communication signal for cross-thread updates ===
class Communication(QObject):
    update_signal = pyqtSignal(str)

# === Server Logic ===

class QuestionServer:
    def __init__(self, comm):
        self.app = Flask(__name__)
        self.comm = comm
        self.setup_routes()

    def setup_routes(self):
        @self.app.route('/current-question', methods=['POST'])
        def update_current_question():
            data = request.get_json()
            if data and 'question' in data and 'title' in data['question']:
                question_title = data['question']['title']
                # Emit signal to update GUI from this thread
                self.comm.update_signal.emit(question_title)
                return jsonify({"status": "success", "message": "Question updated"})
            return jsonify({"status": "error", "message": "Invalid data"}), 400

    def start_server(self):
        # Running Flask in a development server is not ideal for production
        # but fine for this purpose.
        self.app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

    def start_server_thread(self):
        server_thread = threading.Thread(target=self.start_server, daemon=True)
        server_thread.start()
        return server_thread

# === GUI Logic ===

class OverlayInput(QWidget):
    def __init__(self, comm):
        super().__init__()
        self.comm = comm
        self.init_ui()
        # Connect the signal to the update method
        self.comm.update_signal.connect(self.update_display_text)
        self.old_pos = None

    def adjust_width_to_text(self):
        fm = QFontMetrics(self.input.font())
        text_width = fm.horizontalAdvance(self.input.text())
        new_width = max(MIN_WIDTH, text_width + PADDING)
        self.setFixedWidth(new_width)

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Dialog
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedHeight(WINDOW_HEIGHT)
        self.setMinimumWidth(MIN_WIDTH)

        # Center on screen initially
        screen = QApplication.primaryScreen().availableGeometry()
        x = (screen.width() - self.width()) // 2
        y = (screen.height() - self.height()) // 2
        self.move(x, y)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.input = QLineEdit()
        self.input.setPlaceholderText(PLACEHOLDER_TEXT)
        self.input.setStyleSheet(STYLE_SHEET)
        # We don't want the user to type, so make it read-only
        self.input.setReadOnly(True) 
        layout.addWidget(self.input)

        self.setLayout(layout)
        self.adjust_width_to_text()
        self.show()
        
    def update_display_text(self, text):
        """This method is called from the server thread via a signal."""
        self.input.setText(text)
        self.adjust_width_to_text()

    # --- Movable Window Logic ---
    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            self.old_pos = event.globalPosition().toPoint()

    def mouseReleaseEvent(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            self.old_pos = None

    def mouseMoveEvent(self, event: QMouseEvent):
        if not self.old_pos:
            return
        delta = event.globalPosition().toPoint() - self.old_pos
        self.move(self.x() + delta.x(), self.y() + delta.y())
        self.old_pos = event.globalPosition().toPoint()


def main():
    app = QApplication(sys.argv)
    
    # Set up communication object
    comm = Communication()
    
    # Create and show the GUI
    overlay = OverlayInput(comm)
    
    # Create and start the server
    server = QuestionServer(comm)
    server.start_server_thread()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
