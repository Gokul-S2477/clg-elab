import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const Portfolio = () => {
  const { studentId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/auth/profile/${studentId}`);
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [studentId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Profile not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-6 erp-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="erp-card p-12 rounded-[4rem] shadow-xl relative overflow-hidden bg-white mb-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100 rounded-full -mr-32 -mt-32 opacity-50"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="w-40 h-40 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl">
              {profile.name[0]}
            </div>
            <div className="text-center md:text-left">
              <span className="px-5 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full">Scholar Portfolio</span>
              <h1 className="text-5xl font-black text-slate-900 mt-6 tracking-tight">{profile.name}</h1>
              <p className="text-slate-500 mt-3 font-bold text-lg">{profile.email} • {profile.profile?.identifier || "STUDENT"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="md:col-span-2 space-y-10">
            <section className="erp-card p-10 rounded-[3rem] bg-white border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 mb-8">Professional Summary</h3>
                <p className="text-slate-700 leading-relaxed font-medium text-lg italic">
                    "Dedicated {profile.profile?.department || "Academic"} student focused on engineering excellence and innovative problem solving. Passionate about software architecture and collaborative development."
                </p>
            </section>

            <section className="erp-card p-10 rounded-[3rem] bg-white border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 mb-8">Academic Trajectory</h3>
                <div className="space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="w-3 h-3 bg-slate-900 rounded-full mt-2"></div>
                        <div>
                            <p className="font-black text-slate-900">{profile.profile?.department || "Engineering"}</p>
                            <p className="text-sm font-bold text-slate-500">Year {profile.profile?.year || "N/A"} • Section {profile.profile?.section || "N/A"}</p>
                        </div>
                    </div>
                </div>
            </section>
          </div>

          <div className="space-y-10">
            <section className="erp-card p-8 rounded-[3rem] bg-slate-900 text-white shadow-2xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8">Skill Stack</h3>
                <div className="flex flex-wrap gap-3">
                    {["Logic", "Math", "Dev", "UI", "DB"].map(skill => (
                        <span key={skill} className="px-4 py-2 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/20 transition-all cursor-default">
                            {skill}
                        </span>
                    ))}
                </div>
            </section>

            <section className="erp-card p-8 rounded-[3rem] bg-white border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8">Quick Links</h3>
                <div className="space-y-4">
                    <button className="w-full py-4 bg-slate-50 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all">Download CV</button>
                    <button className="w-full py-4 bg-slate-50 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all">Contact Scholar</button>
                </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
