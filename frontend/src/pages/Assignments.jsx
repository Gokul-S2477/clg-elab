import React, { useState, useEffect } from "react";
import axios from "axios";
import { getStoredUser } from "../utils/roleHelper";

const API_BASE = "http://localhost:8000/grading";

const Assignments = () => {
  const currentUser = getStoredUser();
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionContent, setSubmissionContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const assRes = await axios.get(`${API_BASE}/assignments`);
      setAssignments(assRes.data);
      
      const subRes = await axios.get(`${API_BASE}/my-submissions/${currentUser.id}`);
      setSubmissions(subRes.data);
    } catch (err) {
      console.error("Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGrading(true);
    try {
      const res = await axios.post(`${API_BASE}/submit`, {
        assignment_id: selectedAssignment.id,
        student_id: currentUser.id,
        content: submissionContent
      });
      setSubmissions([res.data, ...submissions]);
      setSelectedAssignment(null);
      setSubmissionContent("");
      alert("Submission graded successfully!");
    } catch (err) {
      alert("Grading failed. Please try again.");
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--erp-bg)] pt-24 px-6 pb-12 erp-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-indigo-600">Academic Portal</p>
          <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">AI Smart Assignments</h1>
          <p className="text-slate-600 mt-4 text-sm font-medium">Submit your work for instant AI-powered grading and feedback.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Active Assignments</h3>
            {assignments.map(ass => (
              <div key={ass.id} className="erp-card p-8 rounded-[3rem] bg-white shadow-sm border border-slate-100 hover:shadow-xl transition-all erp-rise-in">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-xl font-black text-slate-900">{ass.title}</h4>
                    <p className="text-sm text-slate-500 font-medium mt-1">{ass.description}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedAssignment(ass)}
                    className="erp-pill-button px-6 py-2.5 bg-indigo-600 text-white border-transparent text-[10px]"
                    style={{ background: '#4f46e5', color: 'white' }}
                  >
                    Start Submission
                  </button>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-xs font-bold text-slate-600 italic">
                    Instructions: {ass.instructions || "Follow the prompt and submit your best effort."}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recent Grades</h3>
            {submissions.map(sub => (
              <div key={sub.id} className="erp-card p-6 rounded-[2.5rem] bg-white shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                    {assignments.find(a => a.id === sub.assignment_id)?.title || "Assignment"}
                  </span>
                  <span className="text-xl font-black text-slate-900">{sub.score}%</span>
                </div>
                <p className="text-xs text-slate-500 font-medium line-clamp-2 italic mb-4">"{sub.ai_feedback?.summary}"</p>
                <div className="pt-4 border-t border-slate-50">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Feedback Hint</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-1">{sub.ai_feedback?.suggestions}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedAssignment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <form onSubmit={handleSubmit} className="erp-card rounded-[3.5rem] p-10 w-full max-w-2xl shadow-2xl erp-rise-in max-h-[90vh] overflow-y-auto">
            <div className="mb-8">
                <h3 className="text-2xl font-black text-slate-900">Submitting: {selectedAssignment.title}</h3>
                <p className="text-sm font-medium text-slate-500 mt-2">{selectedAssignment.description}</p>
            </div>
            
            <div className="space-y-6">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Your Submission (Code or Text)</label>
                    <textarea 
                        required 
                        value={submissionContent} 
                        onChange={e => setSubmissionContent(e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-3xl px-8 py-6 font-mono text-sm text-slate-900 h-64 outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                        placeholder="Paste your work here..."
                    />
                </div>
            </div>

            <div className="flex gap-4 mt-12">
              <button type="button" onClick={() => setSelectedAssignment(null)} disabled={grading} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button type="submit" disabled={grading} className="erp-pill-button flex-1 py-4 bg-indigo-600 text-white border-transparent flex items-center justify-center gap-3" style={{ background: '#4f46e5', color: 'white' }}>
                {grading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        AI Grading...
                    </>
                ) : 'Submit for AI Review'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Assignments;
