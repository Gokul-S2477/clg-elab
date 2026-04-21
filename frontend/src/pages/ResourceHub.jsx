import React, { useState, useEffect } from "react";
import axios from "axios";
import { getStoredUser } from "../utils/roleHelper";

const API_BASE = "http://localhost:8000/campus";

const ResourceHub = () => {
  const currentUser = getStoredUser();
  const [resources, setResources] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newResource, setNewResource] = useState({ title: "", description: "", file_path: "", dept_id: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, [selectedDept]);

  const fetchInitialData = async () => {
    try {
      const deptsRes = await axios.get("http://localhost:8000/user-management/departments");
      setDepartments(deptsRes.data);
      
      const res = await axios.get(`${API_BASE}/resources?dept_id=${selectedDept}`);
      setResources(res.data);
    } catch (err) {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/resources?user_id=${currentUser.id}`, newResource);
      setShowModal(false);
      setNewResource({ title: "", description: "", file_path: "", dept_id: "" });
      fetchInitialData();
    } catch (err) {
      alert("Failed to add resource");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--erp-bg)] pt-24 px-6 pb-12 erp-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-teal-600">Knowledge Base</p>
            <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Resource Hub</h1>
          </div>
          <div className="flex gap-4">
            <select 
                value={selectedDept} 
                onChange={e => setSelectedDept(e.target.value)}
                className="bg-white border border-slate-200 rounded-full px-6 py-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-teal-50 transition-all"
            >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {(currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'faculty') && (
                <button 
                onClick={() => setShowModal(true)} 
                className="erp-pill-button px-8 py-3 bg-teal-600 text-white border-transparent shadow-lg shadow-teal-100"
                style={{ background: '#0d9488', color: 'white' }}
                >
                Add Material
                </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {resources.map(item => (
              <div key={item.id} className="erp-card p-8 rounded-[3rem] shadow-sm hover:shadow-xl transition-all erp-rise-in group">
                <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm font-medium mb-6 line-clamp-2">{item.description || "Study material and references."}</p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                    <span className="text-[10px] font-black uppercase text-teal-600 tracking-widest">{departments.find(d => d.id === item.dept_id)?.name || "Academic"}</span>
                    <a href={item.file_path} target="_blank" rel="noreferrer" className="text-xs font-black text-slate-900 hover:text-teal-600 transition-colors uppercase tracking-widest flex items-center gap-2">
                        View
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                </div>
              </div>
            ))}
            {resources.length === 0 && (
              <div className="col-span-full text-center py-32 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No materials found for this section</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <form onSubmit={handleCreate} className="erp-card rounded-[3.5rem] p-10 w-full max-w-lg shadow-2xl erp-rise-in">
            <h3 className="text-2xl font-black text-slate-900 mb-8">Add Resource</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Resource Title</label>
                <input required placeholder="e.g. Data Structures Notes" value={newResource.title} onChange={e => setNewResource({...newResource, title: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Description</label>
                <input placeholder="Brief summary..." value={newResource.description} onChange={e => setNewResource({...newResource, description: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">File URL / Path</label>
                <input required placeholder="https://..." value={newResource.file_path} onChange={e => setNewResource({...newResource, file_path: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Department</label>
                <select required value={newResource.dept_id} onChange={e => setNewResource({...newResource, dept_id: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900">
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button type="button" onClick={() => setShowModal(false)} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button type="submit" className="erp-pill-button flex-1 py-4 bg-teal-600 text-white border-transparent" style={{ background: '#0d9488', color: 'white' }}>Save Material</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ResourceHub;
