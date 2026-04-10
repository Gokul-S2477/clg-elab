import React from "react";
import { NavLink } from "react-router-dom";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/practice", label: "Practice Arena", icon: "practice" },
  { to: "/playground", label: "Playground", icon: "playground" },
  { to: "/practice/progress", label: "Saved Progress", icon: "progress" },
];

const navIcon = (name) => {
  const common = "h-5 w-5";
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "practice":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M9 7L4 12L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7L20 12L15 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "playground":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M8 10L11 12L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 14H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "progress":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M7 4H17C18.1 4 19 4.9 19 6V20L12 16L5 20V6C5 4.9 5.9 4 7 4Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5A3.5 3.5 0 1 0 12 15.5Z" stroke="currentColor" strokeWidth="2" />
          <path d="M19.4 15A1.7 1.7 0 0 0 20 13.4V10.6A1.7 1.7 0 0 0 19.4 9L17.9 8.2L17.5 6.5A1.7 1.7 0 0 0 15.8 5.2L14.1 4.8L13.3 3.3A1.7 1.7 0 0 0 11.8 2.7H12.2A1.7 1.7 0 0 0 10.7 3.3L9.9 4.8L8.2 5.2A1.7 1.7 0 0 0 6.5 6.5L6.1 8.2L4.6 9A1.7 1.7 0 0 0 4 10.6V13.4A1.7 1.7 0 0 0 4.6 15L6.1 15.8L6.5 17.5A1.7 1.7 0 0 0 8.2 18.8L9.9 19.2L10.7 20.7A1.7 1.7 0 0 0 12.2 21.3H11.8A1.7 1.7 0 0 0 13.3 20.7L14.1 19.2L15.8 18.8A1.7 1.7 0 0 0 17.5 17.5L17.9 15.8L19.4 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};

const Sidebar = ({ collapsed = false }) => {
  const user = getStoredUser();
  const links = isPrivilegedRole(user?.role)
    ? [...navLinks, { to: "/settings", label: "Main Settings", icon: "settings" }]
    : navLinks;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-[#d8e6ff] bg-white/80 py-6 backdrop-blur xl:block ${
        collapsed ? "w-20 px-2" : "w-72 px-5"
      }`}
    >
      <div className="erp-scrollbar h-full overflow-y-auto">
        <div className={`erp-card erp-grid-bg rounded-[28px] ${collapsed ? "p-3" : "p-5"}`}>
      <div className={`rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-lg ${collapsed ? "px-2 py-3 text-center" : "px-4 py-4"}`}>
        {collapsed ? (
          <p className="text-xl font-extrabold">LS</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-100">ERP Portal</p>
            <h1 className="mt-2 text-2xl font-extrabold">Learning Suite</h1>
            <p className="mt-2 text-sm text-blue-50">Coding, practice, and role-based admin controls in one place.</p>
          </>
        )}
      </div>

      <nav className={`mt-6 space-y-2 ${collapsed ? "px-1" : ""}`}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              [
                `flex items-center rounded-2xl text-sm font-semibold transition-all duration-200 ${collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3"}`,
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200"
                  : "text-slate-700 hover:bg-blue-50 hover:text-blue-700",
              ].join(" ")
            }
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-xs font-extrabold text-teal-700 shadow-sm">
              {navIcon(icon)}
            </span>
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-8 rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Workspace</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Practice Arena is now designed as the primary learning space, while admins can still create and manage
            questions from the same shell.
          </p>
        </div>
      )}
      </div>
    </div>
    </aside>
  );
};

export default Sidebar;
