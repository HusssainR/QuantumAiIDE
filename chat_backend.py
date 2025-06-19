from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    msg = data.get('message', '')
    # For now, just echo the message
    return jsonify({'reply': f'You said hiiii: {msg}'})

if __name__ == '__main__':
    app.run(debug=True) 