import sys
import os
from PyQt6.QtWidgets import QApplication, QWidget, QLineEdit, QVBoxLayout
from PyQt6.QtGui import QFontMetrics
from PyQt6.QtCore import Qt

# === Constants ===

MIN_WIDTH = 300
PADDING = 40  # Extra space for padding and cursor
WINDOW_HEIGHT = 100

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

PLACEHOLDER_TEXT = "Type something..."

# === Logic ===

def default_on_enter_callback(text):
    """Default callback for when Enter is pressed."""
    print(f"Entered text: {text}")

class OverlayInput(QWidget):
    def __init__(self, on_enter_callback=None):
        super().__init__()
        self.on_enter_callback = on_enter_callback or default_on_enter_callback
        self.init_ui()

    def center_on_screen(self):
        screen = QApplication.primaryScreen().availableGeometry()
        x = (screen.width() - self.width()) // 2
        y = (screen.height() - self.height()) // 2
        self.move(x, y)

    def adjust_width_to_text(self):
        fm = QFontMetrics(self.input.font())
        text_width = fm.horizontalAdvance(self.input.text())
        new_width = max(MIN_WIDTH, text_width + PADDING)
        self.setFixedWidth(new_width)
        self.center_on_screen()

    def init_ui(self):
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Dialog
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedHeight(WINDOW_HEIGHT)
        self.setMinimumWidth(MIN_WIDTH)
        self.center_on_screen()

        # Layout and input
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.input = QLineEdit()
        self.input.setPlaceholderText(PLACEHOLDER_TEXT)
        self.input.setStyleSheet(STYLE_SHEET)
        self.input.textChanged.connect(self.adjust_width_to_text)
        self.input.returnPressed.connect(self.on_enter)
        layout.addWidget(self.input)

        self.setLayout(layout)
        self.input.setFocus()
        self.adjust_width_to_text()  # Initialize width

        self.show()

    def on_enter(self):
        self.on_enter_callback(self.input.text())
        QApplication.quit()


def show_overlay(on_enter_callback=None):
    app = QApplication(sys.argv)
    window = OverlayInput(on_enter_callback)
    sys.exit(app.exec())


if __name__ == "__main__":
    show_overlay()
