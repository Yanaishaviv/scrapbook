import keyboard
import subprocess
import sys

SHORTCUT = 'ctrl+8'

def open_overlay():
    subprocess.Popen([sys.executable, "../qt_stuff.py"])

if __name__ == "__main__":
    keyboard.add_hotkey(SHORTCUT, open_overlay)

    print(f"Listening for {SHORTCUT}... (Press ESC to exit)")
    keyboard.wait('esc')