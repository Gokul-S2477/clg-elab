import React from "react";
import { Navigate } from "react-router-dom";
import { getStoredUser } from "../utils/roleHelper";

const ProtectedRoute = ({ children, roles = null }) => {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/student-login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
