from scrapbook.shortcut import start_listener
from scrapbook.display_question import display_question
from threading import Thread

if __name__ == "__main__":
    hotkeys_thread = Thread(target=start_listener)
    hotkeys_thread.daemon = True
    hotkeys_thread.start()
    display_question()
