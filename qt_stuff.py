import sys
from PyQt6.QtWidgets import QApplication, QWidget, QLineEdit, QVBoxLayout
from PyQt6.QtCore import Qt

class OverlayInput(QWidget):
    def __init__(self):
        super().__init__()

        # Make the window frameless, transparent, and always on top
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool  # Prevents taskbar icon
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(700, 100)
        self
        self.move(500, 300)  # Position on screen

        # Layout and text field
        layout = QVBoxLayout(self)
        self.input = QLineEdit(self)
        self.input.setPlaceholderText("Type something...")
        self.input.setStyleSheet("""
            QLineEdit {
                background: rgba(30, 30, 30, 220);
                color: white;
                padding: 10px;
                font-size: 18px;
                border-radius: 10px;
                border: 2px solid #555;
            }
        """)
        layout.addWidget(self.input)
        self.setLayout(layout)

        self.input.returnPressed.connect(self.on_enter)

        self.show()
        self.input.setFocus()
        print("i think i am ready")

    def on_enter(self):
        text = self.input.text()
        print(f"You typed: {text}")
        self.close()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = OverlayInput()
    sys.exit(app.exec())
