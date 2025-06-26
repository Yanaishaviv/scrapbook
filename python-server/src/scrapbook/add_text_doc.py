from scrapbook.new_input import show_overlay
import requests


def send_new_doc(text: str):
    """
    Sends a new question to the server.
    """
    requests.post(
        "http://localhost:8080/api/docs/add",
        json={
            "targetFile": "scrapbook.md",
            "text": text,
        },
    )


def main():
    show_overlay(send_new_doc)


if __name__ == "__main__":
    main()
