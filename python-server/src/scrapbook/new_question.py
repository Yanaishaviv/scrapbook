import requests
from scrapbook.new_input import show_overlay


def send_new_question(question: str):
    """
    Sends a new question to the server.
    """
    requests.post(
        "http://localhost:8080/api/question/add",
        json={
            "title": question,
        }
    )

def main():
    show_overlay(send_new_question)

if __name__ == "__main__":
    main()
