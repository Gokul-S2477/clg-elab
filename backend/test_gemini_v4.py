import os
import google.generativeai as genai

api_key = "AIzaSyDe3aqICS2ijKr3g9xuXKawAfOW_KbldTo"
genai.configure(api_key=api_key)
# Using one of the listed models
model = genai.GenerativeModel('gemini-flash-latest')

try:
    response = model.generate_content("hello")
    print(f"SUCCESS with gemini-flash-latest: {response.text}")
except Exception as e:
    print(f"FAILURE: {str(e)}")
