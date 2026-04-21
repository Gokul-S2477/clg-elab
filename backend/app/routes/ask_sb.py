import os
import io
import json
import time
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import PyPDF2

from app.db import get_db
from app.models.ask_sb import ProjectSB, SourceSB, ChatSB
from app.models.user import User, UserRole

router = APIRouter(prefix="/ask-sb", tags=["ask-sb"])

def get_model(model_name='gemini-2.0-flash-lite'):
    api_key = os.getenv("GEMINI_API_KEY", "AIzaSyDe3aqICS2ijKr3g9xuXKawAfOW_KbldTo")
    genai.configure(api_key=api_key)
    
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    return genai.GenerativeModel(model_name, safety_settings=safety_settings)

class ProjectCreate(BaseModel):
    user_id: int
    title: str
    department_id: Optional[int] = None
    class_id: Optional[int] = None

class ChatRequest(BaseModel):
    user_id: int
    message: str

@router.post("/projects")
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role in [UserRole.student, UserRole.faculty]:
        project_count = db.query(ProjectSB).filter(ProjectSB.user_id == payload.user_id).count()
        if project_count >= 2:
            limit_msg = "Student limit reached." if user.role == UserRole.student else "Faculty personal limit reached."
            raise HTTPException(status_code=400, detail=f"{limit_msg} You can only have 2 personal projects.")

    project = ProjectSB(
        user_id=payload.user_id, 
        title=payload.title,
        department_id=payload.department_id,
        class_id=payload.class_id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("/projects")
def list_projects(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role == UserRole.student:
        dept_id = user.profile.department_id if user.profile else None
        class_id = user.profile.class_id if user.profile else None
        return db.query(ProjectSB).filter(
            (ProjectSB.user_id == user_id) | 
            ((ProjectSB.department_id == dept_id) & (ProjectSB.class_id == class_id) & (ProjectSB.department_id != None))
        ).all()
    
    return db.query(ProjectSB).filter(ProjectSB.user_id == user_id).all()

@router.get("/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ProjectSB).filter(ProjectSB.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": project.id,
        "title": project.title,
        "sources": [{"id": s.id, "title": s.title, "created_at": s.created_at} for s in project.sources],
        "chats": [{"id": c.id, "role": c.role, "content": c.content, "created_at": c.created_at} for c in project.chats]
    }

@router.post("/projects/{project_id}/upload")
async def upload_source(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(ProjectSB).filter(ProjectSB.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    content = await file.read()
    text_content = ""
    try:
        if file.filename.lower().endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages: text_content += (page.extract_text() or "") + "\n"
        else: text_content = content.decode('utf-8', errors='ignore')
    except Exception as e: raise HTTPException(status_code=400, detail=f"Failed to extract text: {str(e)}")
    if not text_content.strip(): raise HTTPException(status_code=400, detail="No text content found in file")
    source = SourceSB(project_id=project_id, title=file.filename, content_text=text_content)
    db.add(source); db.commit(); db.refresh(source)
    return {"id": source.id, "title": source.title}

@router.post("/projects/{project_id}/chat")
async def chat(project_id: int, payload: ChatRequest, db: Session = Depends(get_db)):
    project = db.query(ProjectSB).filter(ProjectSB.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    
    # SMART TRUNCATION: Limit context to last 15,000 characters to save quota
    all_text = "\n\n".join([f"--- Source: {s.title} ---\n{s.content_text}" for s in project.sources])
    context = all_text[-15000:] if len(all_text) > 15000 else all_text
    
    if not context.strip(): context = "No documents uploaded yet. Answer from general knowledge."

    full_prompt = f"""You are 'Ask SB', an AI Teacher. Synthesize the following DOCUMENT CONTEXT with your knowledge to teach the student.
    
    DOCUMENT CONTEXT:
    {context}
    
    INSTRUCTIONS:
    - Use a supportive teaching tone.
    - End with a "💡 Key Awareness" section.
    
    STUDENT QUESTION:
    {payload.message}"""

    # Model rotation to avoid limits
    models = ['gemini-2.0-flash-lite', 'gemini-flash-latest']
    
    for model_name in models:
        for attempt in range(2):
            try:
                model = get_model(model_name)
                response = model.generate_content(full_prompt)
                ai_response = response.text
                
                user_msg = ChatSB(project_id=project_id, user_id=payload.user_id, role="user", content=payload.message)
                ai_msg = ChatSB(project_id=project_id, user_id=payload.user_id, role="ai", content=ai_response)
                db.add(user_msg); db.add(ai_msg); db.commit()
                return {"response": ai_response}
            except Exception as e:
                if "429" in str(e):
                    print(f"Rate limit hit on {model_name}, attempt {attempt}. Retrying...")
                    time.sleep(2)
                    continue
                # If it's a different error, try the next model
                break 
    
    raise HTTPException(status_code=500, detail="AI Service is currently at capacity. Please wait 30 seconds and try again.")

@router.get("/projects/{project_id}/mindmap")
async def get_mindmap(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ProjectSB).filter(ProjectSB.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    all_text = "\n\n".join([s.content_text for s in project.sources])
    context = all_text[:10000] # Truncate for mindmap stability
    prompt = f"Generate a hierarchical mindmap JSON (name, children) for: {context}"
    try:
        model = get_model()
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/quiz")
async def get_quiz(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ProjectSB).filter(ProjectSB.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    all_text = "\n\n".join([s.content_text for s in project.sources])
    context = all_text[:10000] # Truncate for quiz stability
    prompt = f"Generate 5 MCQs in JSON list format [{{question, options, answer, explanation}}] for: {context}"
    try:
        model = get_model()
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    project = db.query(ProjectSB).filter(ProjectSB.id == project_id, ProjectSB.user_id == user_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found or permission denied")
    db.delete(project); db.commit()
    return {"status": "deleted"}
