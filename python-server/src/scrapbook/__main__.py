from inspect import getsourcefile
from scrapbook.shortcut import start_listener
from scrapbook.display_question import display_question
from threading import Thread
from scrapbook.new_question import send_new_question
from scrapbook.screenshot_and_input import send_new_doc
from scrapbook import add_text_doc

NEW_QUESTION_SHORTCUT = "<alt>+<ctrl>+q"
NEW_DOC_SHORTCUT = "<alt>+<ctrl>+n"
ADD_TEXT_DOC_SHORTCUT = "<alt>+<ctrl>+m"
new_question_file = getsourcefile(send_new_question)
new_doc_file = getsourcefile(send_new_doc)
add_text_doc_file = getsourcefile(add_text_doc)

shortcuts_to_paths = {
    NEW_QUESTION_SHORTCUT: new_question_file,
    NEW_DOC_SHORTCUT: new_doc_file,
    ADD_TEXT_DOC_SHORTCUT: add_text_doc_file,
}

if __name__ == "__main__":
    hotkeys_thread = Thread(target=start_listener, args=(shortcuts_to_paths,))
    hotkeys_thread.daemon = True
    hotkeys_thread.start()
    display_question()
