import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from "recharts";
import { 
  LayoutDashboard, Zap, BookOpen, PenTool, Award, Rocket, ArrowRight, Bell, Calendar, TrendingUp
} from "lucide-react";
import SaveStatusBadge from "../components/SaveStatusBadge";
import { getDashboardAnalytics } from "../utils/dashboardAnalytics";
import { getContentStudioEventName, readContentStudioWorkspace } from "../utils/contentStudioStorage";
import { getRoleLabel } from "../utils/roleHelper";
import { getAppShellSettings } from "../utils/appShellSettings";

const Dashboard = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(() => getDashboardAnalytics());
  const [lastRefresh, setLastRefresh] = useState(() => new Date().toISOString());
  const [shellSettings, setShellSettings] = useState(() => getAppShellSettings());
  const [realAnnouncements, setRealAnnouncements] = useState([]);

  // Mock data for the chart - in a real app, this would come from the backend
  const chartData = [
    { day: "Mon", score: 65, solved: 12 },
    { day: "Tue", score: 72, solved: 18 },
    { day: "Wed", score: 68, solved: 15 },
    { day: "Thu", score: 85, solved: 25 },
    { day: "Fri", score: 80, solved: 22 },
    { day: "Sat", score: 95, solved: 30 },
    { day: "Sun", score: 90, solved: 28 },
  ];

  useEffect(() => {
    const refresh = () => {
      setAnalytics(getDashboardAnalytics());
      setLastRefresh(new Date().toISOString());
    };
    
    const fetchRealAnnouncements = async () => {
      try {
        const res = await axios.get("http://localhost:8000/campus/announcements?role=" + (analytics.user?.role || "student"));
        setRealAnnouncements(res.data.slice(0, 2));
      } catch (err) { console.error(err); }
    };
    
    refresh();
    fetchRealAnnouncements();

    const refreshShell = () => setShellSettings(getAppShellSettings());
    window.addEventListener("resume-workspace-updated", refresh);
    window.addEventListener("profile-updated", refresh);
    window.addEventListener("app-notification-added", refresh);
    window.addEventListener("app-shell-settings-updated", refreshShell);
    return () => {
      window.removeEventListener("resume-workspace-updated", refresh);
      window.removeEventListener("profile-updated", refresh);
      window.removeEventListener("app-notification-added", refresh);
      window.removeEventListener("app-shell-settings-updated", refreshShell);
    };
  }, [analytics.user?.role]);

  const cards = useMemo(() => [
    { title: "Current Role", value: getRoleLabel(analytics.user?.role), icon: LayoutDashboard, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Practice Progress", value: `${analytics.practice.solved}/${analytics.practice.total}`, icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Study Completion", value: `${analytics.study.completion}%`, icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Profile Strength", value: `${analytics.resume.profileStrength}/6`, icon: Award, color: "text-indigo-600", bg: "bg-indigo-50" },
  ], [analytics]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6 pb-12"
    >
      {/* Header Section */}
      <motion.section variants={itemVariants} className="erp-card erp-grid-bg rounded-[32px] overflow-hidden relative border-none shadow-2xl">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div className="px-8 py-10 relative z-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-600/10 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Command Center
                </span>
                <SaveStatusBadge value={lastRefresh} />
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Welcome back, <span className="erp-text-gradient">{analytics.user?.name || "Student"}</span>.
              </h1>
              <p className="max-w-2xl text-slate-600 text-lg font-medium leading-relaxed">
                Your research workstation is ready. Track your progress, manage assignments, and level up your skills.
              </p>
            </div>
            
            <div className="flex gap-4">
               <button onClick={() => navigate('/ask-sb')} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-slate-200">
                 <Rocket size={18} />
                 Ask Smart Bot
               </button>
            </div>
          </div>

          {realAnnouncements.length > 0 && (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {realAnnouncements.map((ann, idx) => (
                <motion.div 
                  key={ann.id} 
                  whileHover={{ y: -4 }}
                  className="erp-glass rounded-[24px] p-6 cursor-pointer border-blue-100 hover:shadow-xl transition-all group" 
                  onClick={() => navigate("/announcements")}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Bell size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Live Announcement</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(ann.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">{ann.title}</p>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-1">{ann.content}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* KPI Cards */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, idx) => (
          <motion.article 
            key={card.title}
            whileHover={{ y: -5, scale: 1.02 }}
            className="erp-card rounded-[28px] p-6 relative group overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 group-hover:opacity-20 transition-opacity ${card.color.replace('text', 'bg')}`} />
            <div className={`w-12 h-12 rounded-2xl ${card.bg} ${card.color} flex items-center justify-center mb-6`}>
              <card.icon size={24} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{card.title}</p>
            <p className="mt-2 text-4xl font-black text-slate-900 tracking-tight">{card.value}</p>
          </motion.article>
        ))}
      </motion.section>

      {/* Main Content Grid */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        
        {/* Analytics Section */}
        <motion.section variants={itemVariants} className="erp-card rounded-[32px] p-8 space-y-8 border-none shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Performance Trends</h3>
              <p className="text-sm text-slate-500 mt-1 font-medium">Activity and proficiency growth over the last 7 days.</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <TrendingUp size={16} className="text-emerald-500" />
              <span className="text-xs font-bold text-slate-700">+12.5% vs last week</span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600, fill: '#94a3b8'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    fontSize: '12px', fontWeight: 'bold'
                  }} 
                />
                <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => navigate('/practice')} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 text-left group hover:bg-blue-600 hover:border-blue-600 transition-all">
              <p className="text-sm font-bold text-blue-600 group-hover:text-white uppercase tracking-widest">Next Step</p>
              <p className="text-xl font-black text-slate-900 group-hover:text-white mt-1">Practice Arena</p>
              <div className="mt-4 flex items-center gap-2 text-blue-600 group-hover:text-blue-100 text-xs font-bold">
                Jump back in <ArrowRight size={14} />
              </div>
            </button>
            <button onClick={() => navigate('/study')} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-left group hover:bg-slate-900 transition-all">
              <p className="text-sm font-bold text-slate-400 group-hover:text-slate-500 uppercase tracking-widest">Exploration</p>
              <p className="text-xl font-black text-slate-900 group-hover:text-white mt-1">Study Modules</p>
              <div className="mt-4 flex items-center gap-2 text-slate-400 group-hover:text-slate-500 text-xs font-bold">
                Continue learning <ArrowRight size={14} />
              </div>
            </button>
          </div>
        </motion.section>

        {/* Sidebar Tasks / Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <motion.section variants={itemVariants} className="erp-card rounded-[32px] p-8 border-none shadow-xl bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/20 blur-[80px] rounded-full" />
            <h3 className="text-2xl font-black tracking-tight mb-6">Quick Access</h3>
            <div className="space-y-3">
              {[
                { label: "Exam Portal", to: "/exam-portal", icon: Calendar },
                { label: "Resource Hub", to: "/resource-hub", icon: BookOpen },
                { label: "My Portfolio", to: `/portfolio/${analytics.user?.id}`, icon: Award },
                { label: "Assignments", to: "/assignments", icon: PenTool },
              ].map((item) => (
                <button 
                  key={item.to} 
                  onClick={() => navigate(item.to)}
                  className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 border border-white/5 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <item.icon size={20} className="text-blue-400" />
                    </div>
                    <span className="font-bold tracking-tight">{item.label}</span>
                  </div>
                  <ArrowRight size={18} className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </motion.section>

          {/* Profile Pulse */}
          <motion.section variants={itemVariants} className="erp-card rounded-[32px] p-8 relative overflow-hidden border-none shadow-xl">
             <div className="flex items-center gap-4 mb-6">
               <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-md">
                 <span className="text-2xl font-black text-blue-600">
                    {analytics.user?.name?.[0] || "S"}
                 </span>
               </div>
               <div>
                  <h4 className="font-black text-slate-900 text-lg leading-tight">{analytics.user?.name || "Student"}</h4>
                  <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-0.5">Profile Intensity</p>
               </div>
             </div>
             
             <div className="space-y-4">
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(analytics.resume.profileStrength / 6) * 100}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span>Level 1 (Freshman)</span>
                  <span>{analytics.resume.profileStrength}/6 Sections</span>
                </div>
                <button 
                  onClick={() => navigate("/profile")}
                  className="w-full py-4 bg-blue-50 text-blue-600 font-bold rounded-2xl hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                >
                  Optimize Profile
                </button>
             </div>
          </motion.section>
        </div>

      </div>
    </motion.div>
  );
};

export default Dashboard;
