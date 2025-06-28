import requests
from scrapbook.new_input import show_overlay
import sys

IMPORTANCE_MAP = {
    "1": "Low",
    "2": "Medium",
    "3": "High"
}

def send_new_question(question: str, importance: str):
    """
    Sends a new question to the server.
    """
    requests.post(
        "http://localhost:8080/api/question/add",
        json={
            "title": question,
            "importance": IMPORTANCE_MAP[importance]
        }
    )

def send_new_question_and_move(question: str):
    """
    Sends a new question to the server.
    """
    requests.post(
        "http://localhost:8080/api/question/add-and-move",
        json={
            "title": question,
            "importance": "High"
        }
    )


def main():
    parameter = len(sys.argv) > 1 and sys.argv[1]
    if parameter and parameter in '123':
        show_overlay(lambda question: send_new_question(question, parameter))
    else:
        show_overlay(send_new_question_and_move)

if __name__ == "__main__":
    main()
