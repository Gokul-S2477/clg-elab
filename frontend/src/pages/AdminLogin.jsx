import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../utils/api";
import { saveUser } from "../utils/roleHelper";

const roles = [
  { label: "Super Admin", value: "super_admin", id: "superadmin", password: "superadmin@123" },
  { label: "Admin", value: "admin", id: "admin", password: "admin@123" },
  { label: "Faculty", value: "faculty", id: "faculty", password: "faculty@123" },
];

const AdminLogin = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(roles[0].value);
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
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid admin credentials");
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
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/10 rounded-full blur-[140px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-400/10 rounded-full blur-[140px]" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-6xl grid lg:grid-cols-[0.9fr,1.1fr] rounded-[3.5rem] overflow-hidden border border-indigo-100 bg-white/70 backdrop-blur-3xl shadow-[0_50px_120px_rgba(79,70,229,0.1)]"
      >
        {/* Left Side: Form */}
        <div className="p-12 sm:p-20 order-2 lg:order-1 flex flex-col justify-center border-r border-indigo-50/50 bg-white/40">
           <div className="w-full max-w-sm mx-auto">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mb-2">Management Hub</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Admin Access</h2>
                </div>
                <Link to="/student-login" className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                </Link>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Administrative Role</label>
                  <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                    {roles.map(role => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={`py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${selectedRole === role.value ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {role.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Staff Identifier</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-slate-50 border border-blue-100 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-300"
                    placeholder="e.g. ADM001"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Master Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-blue-100 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-300"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest">{error}</div>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-[11px]"
                >
                  {isLoading ? "Synchronizing..." : "Initialize Dashboard"}
                </button>
              </form>
           </div>
        </div>

        {/* Right Side: Info Panel */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-blue-50/80 via-white/40 to-teal-50/80 relative order-1 lg:order-2">
          <div className="absolute inset-0 erp-grid-bg opacity-20" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 border border-blue-200 rounded-full text-[10px] font-black text-blue-600 uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
              Secure Admin Channel
            </div>
            <h1 className="text-5xl font-black text-slate-900 leading-tight tracking-tight">
              Manage the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">Future of Learning.</span>
            </h1>
            <p className="mt-8 text-lg text-slate-600 leading-relaxed max-w-sm font-medium">
              Unified control center for faculty and administrators to curate content, track analytics, and optimize the academic experience.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Available Nodes</p>
             <div className="grid gap-3">
                {roles.map((r, i) => (
                  <motion.div 
                    key={r.value}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-blue-100 hover:bg-white/90 hover:shadow-md transition-all cursor-default group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                        {r.label[0]}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{r.label}</span>
                    </div>
                    <div className="text-[10px] font-black text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Authorized</div>
                  </motion.div>
                ))}
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
