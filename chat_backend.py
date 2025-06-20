from flask import Flask, request, jsonify
from flask_cors import CORS
import qiskit
from groq import Groq
import os

app = Flask(__name__)
CORS(app)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    msg = data.get('message', '')
    output = get_response(msg)
    return jsonify({'reply': output})

if __name__ == '__main__':
    app.run(debug=True) 



def get_response(msg):
    client = Groq(api_key="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")

    chat_completion = client.chat.completions.create(
        messages=[
            {
            "role": "system",
            "content": "You are a helpful assistant that can only answer questions about quantum computing and qiskit."
            },
            {
                "role": "user",
                "content": msg,
            }
        ],
        model="llama-3.3-70b-versatile",
    )

    return(chat_completion.choices[0].message.content)