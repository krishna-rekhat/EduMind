import sys
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from config import Config
from services import AIService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    """Render the main chat interface."""
    return render_template("index.html")

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint to monitor server status."""
    return jsonify({
        "status": "healthy",
        "domain": "Education",
        "timestamp": datetime.now().isoformat()
    }), 200

@app.route("/chat", methods=["POST"])
async def chat():
    """
    Asynchronous POST endpoint for domain-restricted educational chat.
    Input JSON: {"message": "User query"}
    Returns JSON: {"status": "success", "response": "AI reply", "timestamp": "10:45 AM"}
    """
    try:
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Invalid request format. JSON payload required."
            }), 400

        data = request.get_json()
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({
                "status": "error",
                "message": "Message cannot be empty. Please provide an educational question."
            }), 400

        # Query AI Service asynchronously
        ai_reply = await AIService.get_educational_response(user_message)
        current_time = datetime.now().strftime("%I:%M %p")

        return jsonify({
            "status": "success",
            "response": ai_reply,
            "timestamp": current_time
        }), 200

    except ValueError as val_err:
        logging.error(f"Validation error: {val_err}")
        return jsonify({
            "status": "error",
            "message": str(val_err)
        }), 400

    except RuntimeError as run_err:
        logging.error(f"AI Service runtime error: {run_err}")
        return jsonify({
            "status": "error",
            "message": str(run_err)
        }), 502

    except Exception as e:
        logging.exception(f"Unexpected server error: {e}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred while processing your request."
        }), 500

if __name__ == "__main__":
    logging.info(f"Starting EduMind Server on port {Config.PORT}...")
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
