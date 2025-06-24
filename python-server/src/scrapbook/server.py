import threading
from flask import Flask, request, jsonify

class QuestionServer:
    def __init__(self, comm):
        self.app = Flask(__name__)
        self.comm = comm
        self.setup_routes()

    def setup_routes(self):
        @self.app.route("/current-question", methods=["POST"])
        def update_current_question():
            data = request.get_json()
            if data and "question" in data and "title" in data["question"]:
                question_title = data["question"]["title"]
                # Emit signal to update GUI from this thread
                self.comm.update_signal.emit(question_title)
                return jsonify({"status": "success", "message": "Question updated"})
            return jsonify({"status": "error", "message": "Invalid data"}), 400

    def start_server(self):
        # Running Flask in a development server is not ideal for production
        # but fine for this purpose.
        self.app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

    def start_server_thread(self):
        server_thread = threading.Thread(target=self.start_server, daemon=True)
        server_thread.start()
        return server_thread
