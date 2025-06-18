from pynput import keyboard
import subprocess
import sys
import qt_stuff
from inspect import getsourcefile

SHORTCUT = '<ctrl>+8'
command_file = getsourcefile(qt_stuff)

def open_overlay():
    subprocess.run([sys.executable, command_file])

if __name__ == "__main__":
    listener = keyboard.GlobalHotKeys({
        SHORTCUT: open_overlay
    })
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