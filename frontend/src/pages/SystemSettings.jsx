import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getStoredUser, isPrivilegedRole } from "../utils/roleHelper";
import { getProctorSettings, saveProctorSettings } from "../utils/proctorSettings";

const settingCards = [
  {
    key: "copyPasteLocked",
    title: "Disable student copy / paste",
    description: "Blocks copy, cut, paste, paste special, context menu, and common clipboard shortcuts inside Practice Arena for students.",
  },
  {
    key: "extensionGuardEnabled",
    title: "Enable browser guard",
    description: "Shows a guarded overlay when students switch tabs or lose focus. This helps reduce extension and overlay misuse, though browsers do not allow a website to fully disable installed extensions.",
  },
  {
    key: "blurOnFocusLoss",
    title: "Blur on tab switch",
    description: "Locks the workspace with a resume screen whenever the tab loses focus or becomes hidden.",
  },
  {
    key: "requireFullscreen",
    title: "Require fullscreen mode",
    description: "Prompts students to stay in fullscreen before continuing the workspace when proctor guard is active.",
  },
  {
    key: "blockQuestionSelection",
    title: "Block student text selection",
    description: "Prevents question text selection for students while the proctor lock is active.",
  },
  {
    key: "disableStudentNotes",
    title: "Disable notes for students",
    description: "Hides the private notes panel from students while still allowing admins to use it.",
  },
  {
    key: "watermarkEnabled",
    title: "Show learner watermark",
    description: "Displays a soft identity watermark over the workspace so screenshots are traceable during supervised practice.",
  },
];

const SystemSettings = () => {
  const [user] = useState(getStoredUser());
  const [settings, setSettings] = useState(() => getProctorSettings());
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!saveMessage) return undefined;
    const timeout = window.setTimeout(() => setSaveMessage(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  if (!isPrivilegedRole(user?.role)) {
    return <Navigate to="/practice" replace />;
  }

  const handleToggle = (key) => {
    const next = saveProctorSettings({ ...settings, [key]: !settings[key] });
    setSettings(next);
    setSaveMessage("Proctor settings updated");
  };

  return (
    <div className="space-y-6">
      <section className="erp-card rounded-[30px] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">Main Settings</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900">Proctor Controls</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Manage the student protection rules for Practice Arena from one place. These settings apply immediately across the workspace for students, while admins keep normal editing access.
        </p>
        {saveMessage && <p className="mt-4 text-sm font-semibold text-blue-600">{saveMessage}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {settingCards.map((item) => (
          <div key={item.key} className="erp-card rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(item.key)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  settings[item.key]
                    ? "border border-blue-200 bg-blue-50 text-blue-700"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {settings[item.key] ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="erp-card rounded-[28px] border border-amber-100 bg-amber-50/70 p-5">
        <p className="text-sm font-bold text-amber-800">Important note</p>
        <p className="mt-2 text-sm leading-7 text-amber-700">
          A normal web app cannot truly disable installed browser extensions at the browser level. What we can do reliably is harden the page with copy/paste blocking, focus-loss guards, fullscreen checks, and protected overlays so the student workflow is much more controlled.
        </p>
      </section>
    </div>
  );
};

export default SystemSettings;
