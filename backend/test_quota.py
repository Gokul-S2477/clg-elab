import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

models_to_test = [
    'gemini-flash-latest',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp'
]

for model_name in models_to_test:
    print(f"\nTesting model: {model_name}")
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Hello")
        print(f"Success! Response: {response.text[:50]}")
    except Exception as e:
        print(f"Failed: {e}")
