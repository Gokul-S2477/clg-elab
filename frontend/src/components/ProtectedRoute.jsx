import React from "react";
import { Navigate } from "react-router-dom";
import { getStoredUser } from "../utils/roleHelper";

const ProtectedRoute = ({ children }) => {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/student-login" replace />;
  }

  return children;
};

export default ProtectedRoute;
