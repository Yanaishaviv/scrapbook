from inspect import getsourcefile
from scrapbook.shortcut import start_listener
from scrapbook.display_question import display_question
from threading import Thread
from scrapbook.new_question import send_new_question
from scrapbook.screenshot_and_input import send_new_doc
from scrapbook import add_text_doc, break_start, break_stop

SCRAPBOOK_HYPERKEY = "<cmd>+<alt>"

NEW_QUESTION_SHORTCUT = "q"
NEW_QUESTION_IMPORTANCE_HIGH = "3"
NEW_QUESTION_IMPORTANCE_MEDIUM = "2"
NEW_QUESTION_IMPORTANCE_LOW = "1"
NEW_DOC_SHORTCUT = "a"
ADD_TEXT_DOC_SHORTCUT = "w"
START_BREAK_SHORTCUT = "s"
STOP_BREAK_SHORTCUT = "e"
new_question_file = getsourcefile(send_new_question)
new_doc_file = getsourcefile(send_new_doc)
add_text_doc_file = getsourcefile(add_text_doc)
start_break = getsourcefile(break_start)
stop_break = getsourcefile(break_stop)

shortcuts_to_paths = {
    NEW_QUESTION_SHORTCUT: (new_question_file, ()),
    NEW_QUESTION_IMPORTANCE_HIGH: (new_question_file, "3"),
    NEW_QUESTION_IMPORTANCE_MEDIUM: (new_question_file, "2"),
    NEW_QUESTION_IMPORTANCE_LOW: (new_question_file, "1"),
    NEW_DOC_SHORTCUT: (new_doc_file, ()),
    ADD_TEXT_DOC_SHORTCUT: (add_text_doc_file, ()),
    START_BREAK_SHORTCUT: (start_break, ()),
    STOP_BREAK_SHORTCUT: (stop_break, ()),
}

if __name__ == "__main__":
    hotkeys_thread = Thread(
        target=start_listener, args=(shortcuts_to_paths, SCRAPBOOK_HYPERKEY)
    )
    hotkeys_thread.daemon = True
    hotkeys_thread.start()
    display_question()
