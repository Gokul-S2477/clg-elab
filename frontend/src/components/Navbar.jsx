import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRoleLabel, getStoredUser, isPrivilegedRole, logout } from "../utils/roleHelper";

const APP_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/practice", label: "Practice Arena" },
  { to: "/study", label: "Study" },
  { to: "/playground", label: "Playground" },
  { to: "/practice/progress", label: "Saved Progress" },
];

const shellLogo = (
  <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8" aria-hidden="true">
    <rect x="3" y="3" width="26" height="26" rx="9" fill="url(#navLogoGradientCompact)" />
    <path d="M11 16H21" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M16 11L11 16L16 21" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="navLogoGradientCompact" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0F5BD8" />
        <stop offset="1" stopColor="#14B8A6" />
      </linearGradient>
    </defs>
  </svg>
);

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getStoredUser());
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [navVisible, setNavVisible] = useState(true);

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

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY <= 8) {
        setNavVisible(true);
      } else if (currentY > lastY + 6) {
        setNavVisible(false);
      } else if (currentY < lastY - 6) {
        setNavVisible(true);
      }
      lastY = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-30 border-b border-[#0b4fc8] bg-[#0F5BD8] transition-transform duration-300 ${
        navVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3 md:px-6">
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-sm"
            title="Go to Dashboard"
          >
            {shellLogo}
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-white">Learning Suite</p>
            <p className="text-[11px] text-blue-100">Workspace</p>
          </div>
        </div>

        <nav className="erp-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1">
          {APP_LINKS.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={[
                "whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold",
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                  ? "bg-[#0847ab] text-white shadow-sm"
                  : "bg-white/10 text-white",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
          {isPrivilegedRole(user?.role) && (
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className={[
                "whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold",
                location.pathname === "/settings"
                  ? "bg-[#0847ab] text-white shadow-sm"
                  : "bg-[#ffd166]/20 text-[#fff1c2]",
              ].join(" ")}
            >
              Main Settings
            </button>
          )}
        </nav>

        <div className="hidden flex-shrink-0 items-center gap-2 xl:flex">
          <div className="rounded-full bg-white/12 px-3 py-2 text-sm font-medium text-white">
            <span className="text-[#9ef3e4]">Live</span>
            <span className="mx-2 text-white/35">|</span>
            <span>{currentTime}</span>
          </div>

          <div className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-right">
            <p className="text-sm font-bold leading-none text-white">{user?.name || "Guest User"}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-100">
              {getRoleLabel(user?.role) || "User"}
            </p>
          </div>

          {user && (
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-white/20 bg-white px-3 py-2 text-sm font-semibold text-[#0F5BD8]"
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
