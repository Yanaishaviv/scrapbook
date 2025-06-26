"""scrapbook server - A desktop overlay input application with global hotkey support."""

__version__ = "0.1.0"
__author__ = "Yanai Shaviv"
__email__ = "yanaishavivra@gmail.com"

from .shortcut import start_listener, create_shortcut
from .new_input import show_overlay
from .display_question import display_question

__all__ = ["start_listener", "create_shortcut", "show_overlay", "display_question"]
