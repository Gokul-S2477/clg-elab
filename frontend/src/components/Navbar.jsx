import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRoleLabel, getStoredUser, isPrivilegedRole, logout } from "../utils/roleHelper";

const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    const handleStorage = () => setUser(getStoredUser());
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[#d8e6ff] bg-white/85 px-4 py-4 backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 rounded-full border border-blue-100 bg-blue-50/80 px-4 py-2 text-sm font-medium text-slate-700">
          <span className="text-teal-600">Live</span>
          <span>Practice workspace is live</span>
          <span className="hidden text-slate-400 md:inline">|</span>
          <span className="hidden md:inline">Clock: {currentTime}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isPrivilegedRole(user?.role) && (
            <button
              onClick={() => navigate("/practice-arena-admin")}
              className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-100 transition hover:scale-[1.01]"
            >
              Create Question
            </button>
          )}

          <div className="erp-card rounded-full px-4 py-2 text-right">
            <p className="text-sm font-bold text-slate-900">{user?.name || "Guest User"}</p>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-blue-600">
              {getRoleLabel(user?.role)}
            </p>
          </div>

          {user && (
            <button
              onClick={logout}
              className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
