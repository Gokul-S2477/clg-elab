import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StudentLogin from "./pages/StudentLogin";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import Playground from "./pages/Playground";
import StudyHome from "./pages/StudyHome";
import SqlStudyPage from "./pages/SqlStudyPage";
import PracticeArena from "./pages/PracticeArena";
import PracticeArenaAdmin from "./pages/PracticeArenaAdmin";
import QuestionList from "./pages/QuestionList";
import SavedProgress from "./pages/SavedProgress";
import SystemSettings from "./pages/SystemSettings";
import MainLayout from "./layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<StudentLogin />} />
      <Route path="/student-login" element={<StudentLogin />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route element={<MainLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/study"
          element={
            <ProtectedRoute>
              <StudyHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/study/sql"
          element={
            <ProtectedRoute>
              <SqlStudyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice"
          element={
            <ProtectedRoute>
              <QuestionList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/playground"
          element={
            <ProtectedRoute>
              <Playground />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/topic/:topicSlug"
          element={
            <ProtectedRoute>
              <QuestionList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/progress"
          element={
            <ProtectedRoute>
              <SavedProgress />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/:questionId"
          element={
            <ProtectedRoute>
              <PracticeArena />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice-arena-admin"
          element={
            <ProtectedRoute>
              <PracticeArenaAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SystemSettings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/practice" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
