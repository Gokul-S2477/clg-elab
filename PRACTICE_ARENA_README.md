# Practice Arena Question Creation System

## Overview

A complete full-stack Question Creation System for the ERP Platform, enabling faculty, admins, and super admins to create practice questions with advanced features.

---

## ✅ System Features

### Role-Based Access Control
- ✅ **Admin-Only Access**: Only `faculty`, `admin`, and `super_admin` can access the admin panel
- ✅ **Students Blocked**: Students see "Access Denied" message if they try accessing the admin page
- ✅ **Protected Routes**: Uses React Router ProtectedRoute component for frontend protection

### Backend Infrastructure
- ✅ 7 Database Models (Question, Example, TestCase, StarterCode, Solution)
- ✅ Comprehensive API routes with CRUD operations
- ✅ Automatic slug generation from titles
- ✅ Support for multiple programming languages
- ✅ Enum-based validations (difficulty, category, visibility, approach types)

### Frontend Features
- ✅ Professional multi-tab form (LeetCode-style admin panel)
- ✅ 8 organized tabs for different sections
- ✅ Dynamic form inputs for examples, test cases, and solutions
- ✅ Real-time validation and error handling
- ✅ Dark mode support throughout
- ✅ Create Question button in Navbar (admin-only)

---

## 🏗️ Architecture

### Backend Structure
```
backend/
├── app/
│   ├── models/
│   │   ├── user.py
│   │   └── practice_arena.py        (NEW)
│   ├── routes/
│   │   ├── auth.py
│   │   └── practice_arena.py        (NEW)
│   ├── db.py
│   └── main.py
└── requirements.txt
```

### Frontend Structure
```
frontend/src/
├── pages/
│   ├── StudentLogin.jsx
│   ├── AdminLogin.jsx
│   ├── Dashboard.jsx
│   ├── PracticeArena.jsx
│   └── PracticeArenaAdmin.jsx       (NEW)
├── components/
│   ├── Navbar.jsx                   (UPDATED)
│   └── ProtectedRoute.jsx
└── utils/
    └── roleHelper.js
```

---

## 📊 Database Models

### Question
```python
id: Integer (PK)
title: String
slug: String (unique, auto-generated)
difficulty: Enum (easy, medium, hard)
category: Enum (coding, sql, mcq, debugging)
tags: JSON array
problem_statement: Text
short_description: String
input_format: Text
output_format: Text
function_signature: Text
constraints: Text
time_limit: Integer (seconds)
memory_limit: Integer (MB)
points: Integer
visibility: Enum (draft, published, private)
created_by: Integer (user_id FK)
created_at: DateTime
updated_at: DateTime
```

### Example
```python
id: Integer (PK)
question_id: Integer (FK → Question)
input: Text
output: Text
explanation: Text (optional)
```

### TestCase
```python
id: Integer (PK)
question_id: Integer (FK → Question)
input: Text
output: Text
is_hidden: Boolean
```

### StarterCode
```python
id: Integer (PK)
question_id: Integer (FK → Question)
language: Enum (python, java, cpp)
code: Text
```

### Solution
```python
id: Integer (PK)
question_id: Integer (FK → Question)
code: Text
explanation: Text
approach_type: Enum (brute_force, optimized)
```

---

## 🔌 API Endpoints

### Questions CRUD
```
POST   /questions/create              Create new question
GET    /questions/                    List questions (with filters)
GET    /questions/{id}                Get specific question
PUT    /questions/{id}                Update question
DELETE /questions/{id}                Delete question
```

### Related Resources
```
POST   /questions/{id}/examples       Add example
POST   /questions/{id}/testcases      Add test case
POST   /questions/{id}/starter-code   Add starter code
```

---

## 🎨 Frontend UI

### Navbar (Updated)
- "Create Question" button appears only for admin roles
- Purple-styled button for visual distinction
- Alongside Dark Mode and Logout buttons

### PracticeArenaAdmin Page

#### 8 Tabs:
1. **📝 Description** - Problem statement, short description
2. **📥 Input/Output** - Input format, output format, function signature
3. **📊 Constraints** - Problem constraints
4. **📚 Examples** - Examples with input/output/explanation (dynamic)
5. **🧪 Test Cases** - Test cases with hidden toggle (dynamic)
6. **💻 Code Templates** - Starter code for Python, Java, C++
7. **⚙️ Settings** - Time limit, memory, points, visibility
8. **🧠 Solution** - Solution code, explanation, approach type

#### Form Features:
- ✅ Basic info section (title, slug, difficulty, category, tags)
- ✅ Auto-slug generation from title
- ✅ Dynamic tag management
- ✅ Multi-item collections (examples, test cases, solutions)
- ✅ Add/Remove buttons for each collection
- ✅ Form validation
- ✅ Success/Error messaging
- ✅ Cancel button

---

## 🔐 Security & Role Control

### Access Control Flow
```
1. User navigates to /practice-arena-admin
2. ProtectedRoute checks if user is logged in
   ├─ Not logged in → Redirect to /student-login
   └─ Logged in → Check PracticeArenaAdmin component
3. PracticeArenaAdmin checks user role
   ├─ Admin (faculty/admin/super_admin) → Show form
   └─ Student → Show "Access Denied" message
```

---

## 🚀 Getting Started

### Backend Setup

1. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Run migrations** (if using Alembic - optional):
   ```bash
   alembic upgrade head
   ```

3. **Start server**:
   ```bash
   uvicorn app.main:app --reload
   ```

Server runs on `http://localhost:8000`

### Frontend Setup

1. **Install dependencies** (if needed):
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

Frontend runs on `http://localhost:5173`

---

## 📝 Usage Example

### Creating a Question via Admin UI

1. **Login** as admin/faculty user
2. **Click** "Create Question" button in navbar
3. **Fill** basic information (title auto-creates slug)
4. **Add tags** using the tag input
5. **Switch tabs** to add:
   - Problem statement & description
   - Input/output format
   - Constraints
   - Examples (add multiple)
   - Test cases (hidden/visible toggle)
   - Starter code templates
   - Solution code & approach
   - Settings (time, memory, points, visibility)
6. **Submit** - Backend processes and saves all related data

---

## 🧪 Testing

### Test Creating a Question
```bash
# Backend API test
curl -X POST http://localhost:8000/questions/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Two Sum",
    "difficulty": "easy",
    "category": "coding",
    "tags": ["array", "hash-map"],
    "problem_statement": "Find two numbers...",
    "visibility": "published",
    "examples": [],
    "test_cases": []
  }'

# Expected response:
{
  "id": 1,
  "title": "Two Sum",
  "slug": "two-sum",
  ...
}
```

### Test Role-Based Access
1. **As Student**: Navigate to `/practice-arena-admin` → "Access Denied"
2. **As Faculty**: Navigate to `/practice-arena-admin` → See admin form

---

## 🔧 Configuration

### Database URL
Default: `sqlite:///./test.db` (use `DATABASE_URL` env var to override)

### Slugify
Automatically installed, generates URL-friendly slugs from titles

---

## 📦 Dependencies Added

### Backend
```
python-slugify>=8.0.0
```

All other dependencies already in `requirements.txt`:
- FastAPI
- SQLAlchemy
- Uvicorn
- Python-dotenv

### Frontend
Uses existing React Router and Tailwind CSS setup.

---

## ✨ Code Quality

### Backend
- Type hints with Pydantic models
- Proper error handling
- Cascade delete for related models
- Enum-based validations

### Frontend
- Functional components with hooks
- Proper state management
- Role-based conditional rendering
- Dark mode support
- Responsive design (Tailwind)

---

## 🔄 Scalability Features

1. **Modular Structure**: Separate models/routes/pages for each feature
2. **Enum Types**: Easy to extend with new difficulty levels, categories, etc.
3. **Cascade Delete**: Removing a question automatically removes all examples/test cases
4. **Flexible Relationships**: Can add more resources (hints, editorials, etc.) in future
5. **API-First Design**: Frontend consumes REST API independently

---

## 🐛 Known Limitations & Future Enhancements

### Current Limitations
- Rich text editor not implemented (uses textarea)
- No file upload for test data
- No bulk import feature
- No question versioning

### Future Enhancements
- Rich text editor for problem statements
- File upload support (CSV for test cases)
- Bulk question import/export
- AI-assisted question generation
- Question statistics & usage tracking
- Question rating & difficulty calibration
- Duplicate detection

---

## 📞 Support

For questions or issues:
1. Check the API responses for error details
2. Verify role assignment in backend/frontend
3. Ensure database migrations are up to date
4. Check browser console for frontend errors

---

## 📄 License

Part of the ERP Platform - (Year) All Rights Reserved
