import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PageLoader from "./components/PageLoader";
import MainLayout from "./layout/MainLayout";

const StudentLogin = lazy(() => import("./pages/StudentLogin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ExamPortalHome = lazy(() => import("./pages/ExamPortalHome"));
const ExamManagement = lazy(() => import("./pages/ExamManagement"));
const ExamsList = lazy(() => import("./pages/ExamsList"));
const ExamWorkspace = lazy(() => import("./pages/ExamWorkspace"));
const ExamReports = lazy(() => import("./pages/ExamReports"));
const ProfileCenter = lazy(() => import("./pages/ProfileCenter"));
const ResumeBuilder = lazy(() => import("./pages/ResumeBuilder"));
const StudyHome = lazy(() => import("./pages/StudyHome"));
const SqlStudyPage = lazy(() => import("./pages/SqlStudyPage"));
const PythonLearningHome = lazy(() => import("./pages/PythonLearningHome"));
const QuestionList = lazy(() => import("./pages/QuestionList"));
const Playground = lazy(() => import("./pages/Playground"));
const SavedProgress = lazy(() => import("./pages/SavedProgress"));
const PracticeArena = lazy(() => import("./pages/PracticeArena"));
const PracticeArenaAdmin = lazy(() => import("./pages/PracticeArenaAdmin"));
const ContentStudio = lazy(() => import("./pages/ContentStudio"));
const SystemSettings = lazy(() => import("./pages/SystemSettings"));

const withLoader = (node, label) => <Suspense fallback={<PageLoader label={label} />}>{node}</Suspense>;

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={withLoader(<StudentLogin />, "Loading sign-in...")} />
      <Route path="/student-login" element={withLoader(<StudentLogin />, "Loading sign-in...")} />
      <Route path="/admin-login" element={withLoader(<AdminLogin />, "Loading admin access...")} />
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<ProtectedRoute>{withLoader(<Dashboard />, "Loading dashboard...")}</ProtectedRoute>} />
        <Route path="/exam-portal" element={<ProtectedRoute>{withLoader(<ExamPortalHome />, "Loading exam portal...")}</ProtectedRoute>} />
        <Route path="/exam-management" element={<ProtectedRoute roles={["faculty", "admin", "super_admin"]}>{withLoader(<ExamManagement />, "Loading exam management...")}</ProtectedRoute>} />
        <Route path="/exams" element={<ProtectedRoute>{withLoader(<ExamsList />, "Loading your exams...")}</ProtectedRoute>} />
        <Route path="/exams/:examId" element={<ProtectedRoute>{withLoader(<ExamWorkspace />, "Loading exam workspace...")}</ProtectedRoute>} />
        <Route path="/exam-reports/:examId" element={<ProtectedRoute roles={["faculty", "admin", "super_admin"]}>{withLoader(<ExamReports />, "Loading exam reports...")}</ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute>{withLoader(<ProfileCenter />, "Loading profile center...")}</ProtectedRoute>} />
        <Route path="/dashboard/resume-builder" element={<ProtectedRoute>{withLoader(<ResumeBuilder />, "Loading resume builder...")}</ProtectedRoute>} />
        <Route path="/study" element={<ProtectedRoute>{withLoader(<StudyHome />, "Loading study modules...")}</ProtectedRoute>} />
        <Route path="/study/sql" element={<ProtectedRoute>{withLoader(<SqlStudyPage />, "Loading SQL study...")}</ProtectedRoute>} />
        <Route path="/study/python" element={<ProtectedRoute>{withLoader(<PythonLearningHome />, "Loading Python study...")}</ProtectedRoute>} />
        <Route path="/practice" element={<ProtectedRoute>{withLoader(<QuestionList />, "Loading practice bank...")}</ProtectedRoute>} />
        <Route path="/playground" element={<ProtectedRoute>{withLoader(<Playground />, "Loading playground...")}</ProtectedRoute>} />
        <Route path="/practice/topic/:topicSlug" element={<ProtectedRoute>{withLoader(<QuestionList />, "Loading practice topic...")}</ProtectedRoute>} />
        <Route path="/practice/progress" element={<ProtectedRoute>{withLoader(<SavedProgress />, "Loading saved progress...")}</ProtectedRoute>} />
        <Route path="/practice/:questionId" element={<ProtectedRoute>{withLoader(<PracticeArena />, "Loading practice arena...")}</ProtectedRoute>} />
        <Route path="/practice-arena-admin" element={<ProtectedRoute>{withLoader(<PracticeArenaAdmin />, "Loading practice controls...")}</ProtectedRoute>} />
        <Route path="/content-studio" element={<ProtectedRoute>{withLoader(<ContentStudio />, "Loading content studio...")}</ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute>{withLoader(<SystemSettings />, "Loading system settings...")}</ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
