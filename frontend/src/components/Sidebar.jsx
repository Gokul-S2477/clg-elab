import React from "react";
import { NavLink } from "react-router-dom";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", icon: "DB" },
  { to: "/practice", label: "Practice Arena", icon: "PA" },
  { to: "/playground", label: "Playground", icon: "PG" },
  { to: "/practice/progress", label: "Saved Progress", icon: "SP" },
];

const Sidebar = () => {
  const user = getStoredUser();
  const links = isPrivilegedRole(user?.role)
    ? [...navLinks, { to: "/settings", label: "Main Settings", icon: "MS" }]
    : navLinks;

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-[#d8e6ff] bg-white/80 px-5 py-6 backdrop-blur xl:block">
      <div className="erp-scrollbar h-full overflow-y-auto">
        <div className="erp-card erp-grid-bg rounded-[28px] p-5">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-4 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-100">ERP Portal</p>
        <h1 className="mt-2 text-2xl font-extrabold">Learning Suite</h1>
        <p className="mt-2 text-sm text-blue-50">Coding, practice, and role-based admin controls in one place.</p>
      </div>

      <nav className="mt-6 space-y-2">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200"
                  : "text-slate-700 hover:bg-blue-50 hover:text-blue-700",
              ].join(" ")
            }
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-xs font-extrabold text-teal-700 shadow-sm">
              {icon}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-blue-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Workspace</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Practice Arena is now designed as the primary learning space, while admins can still create and manage
          questions from the same shell.
        </p>
      </div>
      </div>
    </div>
    </aside>
  );
};

export default Sidebar;
