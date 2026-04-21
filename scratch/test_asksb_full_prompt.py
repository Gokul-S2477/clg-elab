import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

def get_model():
    api_key = os.getenv("GEMINI_API_KEY", "AIzaSyDe3aqICS2ijKr3g9xuXKawAfOW_KbldTo")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel('gemini-flash-latest')

try:
    model = get_model()
    context = "The capital of France is Paris. The population is 2 million."
    question = "What is the capital of France?"
    full_prompt = f"""You are 'Ask SB', a highly intelligent AI learning assistant.
Your goal is to help students understand their uploaded study materials.

DOCUMENT CONTEXT:
{context}

INSTRUCTIONS:
1. Use the provided DOCUMENT CONTEXT as your primary source of truth.
2. If the answer is in the documents, summarize it clearly.
3. If the answer is NOT in the documents, you may use your general knowledge, but clearly state that the information was not found in the uploaded sources.
4. Maintain a professional, encouraging, and educational tone.
5. Use markdown for formatting (bold, lists, etc.) to make answers easy to read.

STUDENT QUESTION:
{question}"""
    
    response = model.generate_content(full_prompt)
    print("Response successful!")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
