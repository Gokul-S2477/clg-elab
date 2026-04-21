import React, { useState, useEffect } from "react";
import axios from "axios";
import { getStoredUser } from "../utils/roleHelper";

const API_BASE = "http://localhost:8000/campus";

const Announcements = () => {
  const currentUser = getStoredUser();
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newAlert, setNewAlert] = useState({ title: "", content: "", target_role: "all" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await axios.get(`${API_BASE}/announcements?role=${currentUser.role}`);
      setAnnouncements(res.data);
    } catch (err) {
      console.error("Failed to fetch announcements");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/announcements?user_id=${currentUser.id}`, newAlert);
      setShowModal(false);
      setNewAlert({ title: "", content: "", target_role: "all" });
      fetchAnnouncements();
    } catch (err) {
      alert("Failed to post announcement");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--erp-bg)] pt-24 px-6 pb-12 erp-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-600">Communication Hub</p>
            <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Announcements</h1>
          </div>
          {(currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'faculty') && (
            <button 
              onClick={() => setShowModal(true)} 
              className="erp-pill-button px-8 py-3 bg-[var(--erp-primary)] text-white border-transparent shadow-lg shadow-blue-100"
              style={{ background: 'var(--erp-primary)', color: 'white' }}
            >
              Post New Alert
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map(alert => (
              <div key={alert.id} className="erp-card p-8 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all erp-rise-in">
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${alert.target_role === 'all' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                    {alert.target_role === 'all' ? 'Universal' : alert.target_role}
                  </span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(alert.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3">{alert.title}</h3>
                <p className="text-slate-600 leading-relaxed font-medium">{alert.content}</p>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active announcements</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <form onSubmit={handleCreate} className="erp-card rounded-[3.5rem] p-10 w-full max-w-lg shadow-2xl erp-rise-in">
            <h3 className="text-2xl font-black text-slate-900 mb-8">Post Announcement</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Alert Title</label>
                <input required placeholder="e.g. End Semester Exam Schedule" value={newAlert.title} onChange={e => setNewAlert({...newAlert, title: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Content</label>
                <textarea required placeholder="Detailed message..." value={newAlert.content} onChange={e => setNewAlert({...newAlert, content: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 h-32" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Target Audience</label>
                <select value={newAlert.target_role} onChange={e => setNewAlert({...newAlert, target_role: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900">
                  <option value="all">Everyone</option>
                  <option value="student">Students Only</option>
                  <option value="faculty">Faculty Only</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button type="button" onClick={() => setShowModal(false)} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button type="submit" className="erp-pill-button flex-1 py-4 bg-blue-600 text-white border-transparent" style={{ background: '#2563eb', color: 'white' }}>Broadcast Alert</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Announcements;
