import os
import google.generativeai as genai

# Try variation with lowercase 'l'
api_key = "AlzaSyDe3aqICS2ijKr3g9xuXKawAfOW_KbIdTo"
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

try:
    response = model.generate_content("hello")
    print(f"SUCCESS with lowercase l: {response.text}")
except Exception as e:
    print(f"FAILURE with lowercase l: {str(e)}")
