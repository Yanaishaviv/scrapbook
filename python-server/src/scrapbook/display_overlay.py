import sys
from PyQt6.QtWidgets import QApplication, QLabel, QVBoxLayout
from PyQt6.QtGui import QFontMetrics
from PyQt6.QtCore import Qt
from server import QuestionServer
from overlay import PADDING

MIN_WIDTH = 100

try:
    from qframelesswindow import FramelessWindow
    FRAMELESS_AVAILABLE = True
except ImportError:
    from PyQt6.QtWidgets import QWidget
    FramelessWindow = QWidget
    FRAMELESS_AVAILABLE = False
    print("PyQt6-Frameless-Window not installed. Install with: pip install PyQt6-Frameless-Window")

# Reuse the same style for consistency
LABEL_STYLE_SHEET = """
    QLabel {
        background-color: rgba(30, 30, 30, 220);
        color: white;
        padding: 10px;
        font-size: 18px;
        border-radius: 8px;
        border: 2px solid #444;
    }
"""

class WaylandDisplayOverlay(FramelessWindow):
    def __init__(self):
        super().__init__()
        self.init_display_ui()

    def init_display_ui(self):
        if FRAMELESS_AVAILABLE:
            # Use the frameless window library for better Wayland support
            self.setWindowFlags(Qt.WindowType.WindowStaysOnTopHint)
        else:
            # Fallback for when library is not available
            self.setWindowFlags(
                Qt.WindowType.FramelessWindowHint
                | Qt.WindowType.WindowStaysOnTopHint
                | Qt.WindowType.Tool  # Tool windows work better on Wayland
            )
        
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)

        self.label = QLabel()
        self.label.setStyleSheet(LABEL_STYLE_SHEET)
        self.label.setWordWrap(True)
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.label)

        self.setLayout(layout)
        self.adjust_size_to_text()
        self.show()

    def adjust_size_to_text(self):
        if not hasattr(self, 'label') or not self.label.text():
            self.resize(MIN_WIDTH, 50)
            return
            
        # Calculate optimal size based on text
        fm = QFontMetrics(self.label.font())
        text_rect = fm.boundingRect(0, 0, 400, 0, Qt.TextFlag.TextWordWrap, self.label.text())
        
        # Add padding for the label styling
        height = text_rect.height() + 30
        fm = QFontMetrics(self.label.font())
        text_width = fm.horizontalAdvance(self.label.text())
        new_width = max(MIN_WIDTH, text_width + PADDING)
        
        self.resize(new_width, height)
    
        # self.setFixedWidth(new_width)


    def update_display_text(self, text):
        self.label.setText(text)
        self.adjust_size_to_text()

def show_wayland_display_overlay():
    app = QApplication(sys.argv)
    
    server = QuestionServer()
    overlay_window = WaylandDisplayOverlay()
    server.set_overlay_window(overlay_window)
    
    server.start_server_thread()
    
    print("Server started on port 5000")
    print("Wayland-compatible display overlay active")
    if not FRAMELESS_AVAILABLE:
        print("Note: For better Wayland support, install: pip install PyQt6-Frameless-Window")
    
    sys.exit(app.exec())

if __name__ == "__main__":
    show_wayland_display_overlay()