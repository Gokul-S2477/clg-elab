import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRoleLabel, getStoredUser, isPrivilegedRole, logout } from "../utils/roleHelper";
import { clearNotifications, getAppNotifications, markAllNotificationsRead, markNotificationRead, APP_NOTIFICATION_EVENT } from "../utils/appNotifications";
import { getAppShellSettings } from "../utils/appShellSettings";
import { getQuickActions, searchAppEntries } from "../utils/appSearch";
import { getContentStudioEventName, readContentStudioWorkspace } from "../utils/contentStudioStorage";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  {
    to: "/exams",
    label: "Exams",
    children: [
      { to: "/exam-portal", label: "Exam Portal", hint: "Open the exam command center" },
      { to: "/exams", label: "Exam Directory", hint: "Open the list of available exams" },
    ],
  },
  { to: "/practice", label: "Practice" },
  {
    to: "/study",
    label: "Study",
    children: [
      { to: "/study", label: "Study Modules", hint: "Open the learning module home" },
      { to: "/study/sql", label: "SQL", hint: "Open the full SQL learning module" },
      { to: "/study/python", label: "Python", hint: "Open the separate Python learning module" },
    ],
  },
  {
    to: "/playground",
    label: "Playground",
    children: [
      { to: "/playground?module=compiler", label: "Compiler Lab", hint: "Open the code compiler directly" },
      { to: "/playground?module=app", label: "App Playground", hint: "Open the app builder directly" },
      { to: "/playground?module=sql", label: "SQL Playground", hint: "Open the SQL lab directly" },
      { to: "/playground?module=notebook", label: "Notebook Lab", hint: "Open the notebook workspace directly" },
    ],
  },
  { to: "/ask-sb", label: "Ask SB" },
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

const userIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" aria-hidden="true">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
    <path d="M4 20C5.6 16.7 8.4 15 12 15C15.6 15 18.4 16.7 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const bellIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" aria-hidden="true">
    <path d="M15 17H9C7.34 17 6 15.66 6 14V11C6 7.69 8.69 5 12 5C15.31 5 18 7.69 18 11V14C18 15.66 16.66 17 15 17Z" stroke="currentColor" strokeWidth="2" />
    <path d="M10 19C10.38 20.14 11.06 20.7 12 20.7C12.94 20.7 13.62 20.14 14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const chevronDown = (
  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const toneClassMap = {
  info: "bg-blue-50 text-blue-700 border-blue-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  danger: "bg-rose-50 text-rose-700 border-rose-100",
};

const menuPanelClass = "absolute top-[calc(100%+10px)] z-40 rounded-[22px] border border-blue-100 bg-white p-3 shadow-[0_20px_60px_rgba(15,91,216,0.2)]";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getStoredUser());
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  const [navVisible, setNavVisible] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState("");
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(getAppNotifications());
  const [announcement, setAnnouncement] = useState(() => readContentStudioWorkspace().announcements?.[0] || null);
  const [shellSettings, setShellSettings] = useState(() => getAppShellSettings());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })), 1000);
    const syncUser = () => setUser(getStoredUser());
    const syncNotifications = () => setNotifications(getAppNotifications());
    const syncContent = () => setAnnouncement(readContentStudioWorkspace().announcements?.[0] || null);
    const syncShell = () => setShellSettings(getAppShellSettings());
    window.addEventListener("storage", syncUser);
    window.addEventListener("user-updated", syncUser);
    window.addEventListener(APP_NOTIFICATION_EVENT, syncNotifications);
    window.addEventListener(getContentStudioEventName(), syncContent);
    window.addEventListener("app-shell-settings-updated", syncShell);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("user-updated", syncUser);
      window.removeEventListener(APP_NOTIFICATION_EVENT, syncNotifications);
      window.removeEventListener(getContentStudioEventName(), syncContent);
      window.removeEventListener("app-shell-settings-updated", syncShell);
    };
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY <= 8) setNavVisible(true);
      else if (currentY > lastY + 6) setNavVisible(false);
      else if (currentY < lastY - 6) setNavVisible(true);
      lastY = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setNotificationOpen(false);
        setAccountOpen(false);
        setOpenNavMenu("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const quickActions = useMemo(() => getQuickActions(user), [user]);
  const filteredEntries = useMemo(() => searchAppEntries(user, search), [search, user]);

  const roleLabel = getRoleLabel(user?.role) || "User";

  const goTo = (to) => {
    setPaletteOpen(false);
    setNotificationOpen(false);
    setAccountOpen(false);
    setOpenNavMenu("");
    setSearch("");
    navigate(to);
  };

  const isNavActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <>
      <header className={`fixed left-0 right-0 top-0 z-30 border-b border-[#0b4fc8] bg-[#0F5BD8] transition-transform duration-300 ${navVisible ? "translate-y-0" : "-translate-y-full"}`}>
        {shellSettings.announcementBannerEnabled && announcement && (
          <div className="border-b border-white/10 bg-[#0847ab] px-4 py-2 text-center text-[11px] font-semibold tracking-[0.16em] text-blue-100">
            {announcement.title}: <span className="tracking-normal text-white/90">{announcement.message}</span>
          </div>
        )}
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 md:px-6">
          <div className="flex flex-shrink-0 items-center gap-3">
            <button type="button" onClick={() => navigate("/dashboard")} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-sm" title="Go to Dashboard">
              {shellLogo}
            </button>
            <div className="hidden lg:block">
              <p className="text-sm font-bold text-white">Learning Suite</p>
              <p className="text-[10px] text-blue-100">Unified Workspace</p>
            </div>
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-2 lg:flex">
            {NAV_ITEMS.map((item) => (
              <div key={item.to} className="relative">
                <button
                  type="button"
                  onClick={() => item.children ? setOpenNavMenu((current) => (current === item.to ? "" : item.to)) : goTo(item.to)}
                  onDoubleClick={() => goTo(item.to)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition",
                    isNavActive(item.to) ? "bg-[#0847ab] text-white shadow-sm" : "bg-white/10 text-white hover:bg-white/14",
                  ].join(" ")}
                >
                  {item.label}
                  {item.children && <span className="text-white/80">{chevronDown}</span>}
                </button>

                {item.children && openNavMenu === item.to && (
                  <div className={`${menuPanelClass} left-1/2 w-[270px] -translate-x-1/2`}>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => goTo(item.to)}
                        className="w-full rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left transition hover:bg-blue-100/70"
                      >
                        <p className="text-sm font-bold text-slate-900">Open {item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">Go to the main {item.label.toLowerCase()} page</p>
                      </button>
                      {item.children.map((child) => (
                        <button
                          key={child.to}
                          type="button"
                          onClick={() => goTo(child.to)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-100 hover:bg-blue-50/70"
                        >
                          <p className="text-sm font-bold text-slate-900">{child.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{child.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isPrivilegedRole(user?.role) && (
              <>
                <button
                  type="button"
                  onClick={() => goTo("/exam-management")}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition",
                    location.pathname === "/exam-management" ? "bg-[#0847ab] text-white shadow-sm" : "bg-white/10 text-white hover:bg-white/14",
                  ].join(" ")}
                >
                  Exam Admin
                </button>
                <button
                  type="button"
                  onClick={() => goTo("/content-studio")}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition",
                    location.pathname === "/content-studio" ? "bg-[#0847ab] text-white shadow-sm" : "bg-white/10 text-white hover:bg-white/14",
                  ].join(" ")}
                >
                  Content
                </button>
                <button
                  type="button"
                  onClick={() => goTo("/user-management")}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition",
                    location.pathname === "/user-management" ? "bg-[#0847ab] text-white shadow-sm" : "bg-white/10 text-white hover:bg-white/14",
                  ].join(" ")}
                >
                  Users
                </button>
              </>
            )}
          </nav>

          <div className="hidden flex-shrink-0 items-center gap-2 xl:flex">
            <div className="rounded-full bg-white/12 px-3 py-2 text-xs font-semibold text-white">
              <span>{currentTime}</span>
            </div>

            {shellSettings.commandPaletteEnabled && (
              <button type="button" onClick={() => setPaletteOpen(true)} className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white">
                Search
              </button>
            )}

            {shellSettings.activityFeedEnabled && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen((value) => !value);
                    setAccountOpen(false);
                    setOpenNavMenu("");
                  }}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
                >
                  {bellIcon}
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <div className={`${menuPanelClass} right-0 w-[340px]`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Activity Feed</p>
                        <p className="text-xs text-slate-500">Recent saves, imports, and content updates</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <button type="button" onClick={() => { markAllNotificationsRead(); setNotifications(getAppNotifications()); }} className="text-blue-700">Read all</button>
                        <button type="button" onClick={() => { clearNotifications(); setNotifications([]); }} className="text-slate-500">Clear</button>
                      </div>
                    </div>
                    <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">No activity yet.</div>
                      ) : notifications.map((notification) => (
                        <button key={notification.id} type="button" onClick={() => { markNotificationRead(notification.id); setNotifications(getAppNotifications()); if (notification.href) goTo(notification.href); }} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-100 hover:bg-blue-50/70">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{notification.title}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${toneClassMap[notification.tone] || toneClassMap.info}`}>{notification.tone}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAccountOpen((value) => !value);
                  setNotificationOpen(false);
                  setOpenNavMenu("");
                }}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0F5BD8]">
                  {userIcon}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-50">{roleLabel}</span>
                <span className="text-white/80">{chevronDown}</span>
              </button>

              {accountOpen && (
                <div className={`${menuPanelClass} right-0 w-[230px]`}>
                  <div className="rounded-[18px] bg-blue-50 px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">{user?.name || "User"}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">{roleLabel}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => goTo("/profile")}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <span className="text-[#0F5BD8]">{userIcon}</span>
                      <span>Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {shellSettings.commandPaletteEnabled && paletteOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm" onClick={() => setPaletteOpen(false)}>
          <div className="mx-auto mt-28 w-full max-w-2xl px-4" onClick={(event) => event.stopPropagation()}>
            <div className="rounded-[30px] border border-blue-100 bg-white p-5 shadow-[0_30px_80px_rgba(15,91,216,0.2)]">
              <div className="flex items-center gap-3 rounded-[22px] border border-blue-100 bg-[#f8fbff] px-4 py-3">
                <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pages, modules, and quick actions" className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none" />
                <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">Ctrl K</span>
              </div>
              <div className="mt-5 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Quick Actions</p>
                  <div className="mt-3 space-y-2">
                    {quickActions.map((action) => (
                      <button key={action.to} type="button" onClick={() => goTo(action.to)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700">{action.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Results</p>
                  <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {filteredEntries.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">No matching routes or study topics found.</div>
                    ) : filteredEntries.map((entry) => (
                      <button key={entry.id} type="button" onClick={() => goTo(entry.to)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-100 hover:bg-blue-50/70">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{entry.label}</p>
                            <p className="mt-1 text-xs text-slate-500">{entry.hint}</p>
                          </div>
                          {entry.type && <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">{entry.type}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
