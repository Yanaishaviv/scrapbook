import threading
from flask import Flask, request, jsonify

class QuestionServer:
    def __init__(self):
        self.app = Flask(__name__)
        self.current_question = ""
        self.overlay_window = None
        self.setup_routes()
    
    def setup_routes(self):
        @self.app.route('/current-question', methods=['POST'])
        def update_current_question():
            data = request.get_json()
            if data and 'question' in data and 'title' in data['question']:
                self.current_question = data['question']['title']
                if self.overlay_window:
                    self.overlay_window.update_display_text(self.current_question)
                return jsonify({"status": "success", "message": "Question updated"})
            return jsonify({"status": "error", "message": "Invalid data"}), 400

        @self.app.route('/current-question', methods=['GET'])
        def get_current_question():
            return jsonify({"text": self.current_question})
    
    def set_overlay_window(self, window):
        self.overlay_window = window
    
    def start_server(self):
        self.app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
    
    def start_server_thread(self):
        server_thread = threading.Thread(target=self.start_server, daemon=True)
        server_thread.start()
        return server_thread
