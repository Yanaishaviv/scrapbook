import os
from scrapbook.new_input import show_overlay
from tempfile import gettempdir
import requests

screenshot_filename = os.path.join(gettempdir(), "scrapbook_tmp.png")


def send_new_doc(question: str):
    """
    Sends a new question to the server.
    """
    requests.post(
        "http://localhost:8080/api/docs/add",
        json={
            "text": question,
            "imageFilename": screenshot_filename,
        },
    )


def main():
    if os.path.exists(screenshot_filename):
        os.remove(screenshot_filename)
    os.system("flameshot gui -s -p " + screenshot_filename)
    show_overlay(send_new_doc)


if __name__ == "__main__":
    main()
