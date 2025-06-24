from scrapbook.shortcut import start_listener
from scrapbook.display_overlay import display_question
from threading import Thread

if __name__ == "__main__":
    Thread(target=start_listener).start()
    display_question()
