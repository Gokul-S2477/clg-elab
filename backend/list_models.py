import google.generativeai as genai

api_key = "AIzaSyDe3aqICS2ijKr3g9xuXKawAfOW_KbldTo"
genai.configure(api_key=api_key)

for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
