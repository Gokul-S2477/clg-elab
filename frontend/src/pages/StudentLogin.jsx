import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../utils/api";
import { saveUser } from "../utils/roleHelper";

const StudentLogin = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          role: "student",
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid student ID or password");
      }

      const payload = await response.json();
      saveUser(payload.user, payload.access_token);
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Unable to login right now");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--erp-bg)] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-400/10 rounded-full blur-[120px]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-6xl grid lg:grid-cols-[1.1fr,0.9fr] rounded-[3.5rem] overflow-hidden border border-blue-100 bg-white/70 backdrop-blur-3xl shadow-[0_40px_100px_rgba(15,91,216,0.12)]"
      >
        {/* Left Side: Immersive Visuals */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-blue-50/80 via-white/40 to-teal-50/80 relative">
          <div className="absolute inset-0 erp-grid-bg opacity-20" />
          
          <div className="relative z-10">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.4em] text-blue-600">Notebook Pro</span>
              </div>
              <h1 className="text-6xl font-black text-slate-900 leading-[1.1] tracking-tight">
                Your Academic <br />
                <span className="erp-text-gradient">Intelligence Hub.</span>
              </h1>
              <p className="mt-8 text-xl text-slate-600 leading-relaxed max-w-md font-medium">
                Experience a revolutionary workspace designed for students to master complex concepts through AI-driven insights.
              </p>
            </motion.div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-6">
            {[
              { label: "Mindmaps", value: "Visual", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
              { label: "Quizzes", value: "Smart", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { label: "Dialogue", value: "Realtime", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="p-5 rounded-3xl bg-white/60 border border-blue-100/50 backdrop-blur-xl shadow-sm"
              >
                <div className="text-blue-600 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{stat.value}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-12 sm:p-20 flex flex-col justify-center bg-white/40 backdrop-blur-3xl border-l border-blue-50">
          <div className="w-full max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mb-2">Login Portal</p>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Student Access</h2>
              </div>
              <Link to="/admin-login" className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Academic ID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-slate-50 border border-blue-100 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                    placeholder="e.g. STU9912"
                    required
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Secure Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-blue-100 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                    placeholder="••••••••"
                    required
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 uppercase tracking-widest text-[11px]">
                    Enter Workspace
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StudentLogin;
