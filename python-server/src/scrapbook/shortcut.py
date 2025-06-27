from pynput import keyboard
import subprocess
import sys


def create_shortcut(path_to_file: str) -> dict:
    """
    Creates a global keyboard shortcut that executes the specified Python file.

    :param shortcut: The keyboard shortcut to listen for (e.g., "<alt>+<ctrl>+q").
    :param path_to_file: The absolute path to the Python file to execute.
    """
    return lambda: subprocess.run([sys.executable, path_to_file])


def start_listener(shortcuts_to_paths: dict, scrapbook_hyperkey: str):
    """
    Starts a global keyboard listener that listens for specific shortcuts
    and executes the the corresponding _files_.

    example for shortcuts_to_paths:
    ```
    {
        "<alt>+<ctrl>+q": "path/to/new_question.py",
        "<alt>+<ctrl>+n": "path/to/screenshot_and_input.py"
    }
    ```
    The shortcuts should be in the format recognized by pynput.
    The paths should be absolute paths to the Python files to execute.
    """
    shortcut_dict = {
        scrapbook_hyperkey + "+" + shortcut: create_shortcut(path)
        for shortcut, path in shortcuts_to_paths.items()
    }
    listener = keyboard.GlobalHotKeys(shortcut_dict)
    listener.start()
    print(f"Listening for {list(shortcut_dict.keys())}...")
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
