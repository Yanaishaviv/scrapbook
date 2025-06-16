import keyboard
import subprocess

def open_overlay():
    subprocess.Popen(["python", "scrapbook\\qt_stuff.py"])

if __name__ == "__main__":
    # Listen for Ctrl+L+R pressed together
    keyboard.add_hotkey('ctrl+l+r', open_overlay)

    print("Listening for Ctrl+L+R... (Press ESC to exit)")
    keyboard.wait('esc')