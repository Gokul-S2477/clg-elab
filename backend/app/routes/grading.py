import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai

from app.db import get_db
from app.models.submission import Assignment, Submission
from app.models.user import User

router = APIRouter(prefix="/grading", tags=["grading"])

class SubmissionCreate(BaseModel):
    assignment_id: int
    student_id: int
    content: str

def get_ai_feedback(assignment_title, assignment_desc, student_content):
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"score": 0, "feedback": "AI key not configured"}
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
    Act as an expert academic grader. Grade the following student submission.
    
    Assignment Title: {assignment_title}
    Assignment Description: {assignment_desc}
    
    Student Submission:
    {student_content}
    
    Return the response strictly in JSON format:
    {{
        "score": (0-100),
        "summary": "one line summary",
        "detailed_feedback": "bullet points of what was good and what needs work",
        "suggestions": "how to improve"
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        # Clean the response to ensure it's valid JSON
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        return json.loads(text)
    except Exception as e:
        print(f"AI Grading Error: {e}")
        return {"score": 0, "feedback": "AI grading failed"}

@router.post("/submit")
def submit_assignment(payload: SubmissionCreate, db: Session = Depends(get_db)):
    assignment = db.query(Assignment).filter(Assignment.id == payload.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Generate AI Feedback
    ai_result = get_ai_feedback(assignment.title, assignment.description, payload.content)
    
    submission = Submission(
        assignment_id=payload.assignment_id,
        student_id=payload.student_id,
        content=payload.content,
        status="graded",
        score=ai_result.get("score", 0),
        ai_feedback=ai_result
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    return submission

@router.get("/my-submissions/{student_id}")
def list_my_submissions(student_id: int, db: Session = Depends(get_db)):
    return db.query(Submission).filter(Submission.student_id == student_id).all()

@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db)):
    return db.query(Assignment).all()
