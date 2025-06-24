from pynput import keyboard
import subprocess
import sys
from . import new_question
from inspect import getsourcefile

SHORTCUT = "<ctrl>+8"
command_file = getsourcefile(new_question)


def open_overlay():
    subprocess.run([sys.executable, command_file])


def start_listener():
    listener = keyboard.GlobalHotKeys({SHORTCUT: open_overlay})
    listener.start()
    print(f"Listening for {SHORTCUT}... (Press Ctrl+C to exit)")
    # stop the listener when Ctrl+C is pressed
    try:
        listener.join()
    except KeyboardInterrupt:
        print("Exiting...")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        listener.stop()
        print("Listener stopped.")
        sys.exit(0)


if __name__ == "__main__":
    start_listener()
