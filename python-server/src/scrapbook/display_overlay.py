import sys
from PyQt6.QtWidgets import (
    QApplication,
    QWidget,
    QLineEdit,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
)
from PyQt6.QtGui import QFontMetrics, QMouseEvent
from PyQt6.QtCore import Qt, pyqtSignal, QObject
import requests
from scrapbook.server import QuestionServer

# === Constants ===

MIN_WIDTH = 150  # Increased to accommodate button
PADDING = 40  # Extra space for padding and cursor
WINDOW_HEIGHT = 50
BUTTON_WIDTH = 65

STYLE_SHEET = """
    QLineEdit {
        background-color: rgba(30, 30, 30, 220);
        color: white;
        padding: 10px;
        font-size: 18px;
        border-radius: 8px;
        border: 2px solid #444;
    }
    QPushButton {
        background-color: rgba(60, 60, 60, 220);
        color: white;
        padding: 10px;
        font-size: 16px;
        border-radius: 8px;
        border: 2px solid #666;
        font-weight: bold;
    }
    QPushButton:hover {
        background-color: rgba(80, 80, 80, 220);
        border: 2px solid #888;
    }
    QPushButton:pressed {
        background-color: rgba(40, 40, 40, 220);
        border: 2px solid #444;
    }
"""

PLACEHOLDER_TEXT = "Waiting for question..."


# === Communication signal for cross-thread updates ===
class Communication(QObject):
    update_signal = pyqtSignal(str)

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
        new_width = max(
            MIN_WIDTH, text_width + PADDING + BUTTON_WIDTH + 10
        )  # Added button width + spacing
        self.setFixedWidth(new_width)

    def init_ui(self):
        self.setWindowFlags(Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Dialog)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedHeight(WINDOW_HEIGHT)
        self.setMinimumWidth(MIN_WIDTH)

        # Center on screen initially
        screen = QApplication.primaryScreen().availableGeometry()
        x = (screen.width() - self.width()) // 2
        y = (screen.height() - self.height()) // 2
        self.move(x, y)

        # Main vertical layout
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)

        # Horizontal layout for button and input
        horizontal_layout = QHBoxLayout()
        horizontal_layout.setSpacing(5)  # Small gap between button and input

        # Create button
        self.button = QPushButton("Done")
        self.button.setFixedWidth(BUTTON_WIDTH)
        self.button.clicked.connect(self.on_button_pressed)

        # Create input
        self.input = QLineEdit()
        self.input.setPlaceholderText(PLACEHOLDER_TEXT)
        self.input.setReadOnly(True)

        # Add widgets to horizontal layout
        horizontal_layout.addWidget(self.button)
        horizontal_layout.addWidget(self.input)

        # Add horizontal layout to main layout
        main_layout.addLayout(horizontal_layout)

        # Apply styles
        self.setStyleSheet(STYLE_SHEET)

        self.adjust_width_to_text()
        self.show()

    def on_button_pressed(self):
        """Function called when button is pressed."""
        requests.get("http://localhost:8080/api/question/complete")

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


def display_question():
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
    display_question()
