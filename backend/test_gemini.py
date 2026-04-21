import os
import google.generativeai as genai

api_key = "AIzaSyDe3aqICS2ijKr3g9xuXKawAfOW_KbIdTo"
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

try:
    response = model.generate_content("hello")
    print(f"SUCCESS: {response.text}")
except Exception as e:
    print(f"FAILURE: {str(e)}")
