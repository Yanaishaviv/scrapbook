import keyboard
import subprocess
import sys
import qt_stuff
from inspect import getsourcefile

SHORTCUT = 'ctrl+8'
command_file = getsourcefile(qt_stuff)

def open_overlay():
    subprocess.run([sys.executable, command_file])

if __name__ == "__main__":
    keyboard.add_hotkey(SHORTCUT, open_overlay)

    print(f"Listening for {SHORTCUT}... (Press ESC to exit)")
    keyboard.wait('esc')