import React, { useState, useEffect } from "react";
import axios from "axios";
import { getStoredUser } from "../utils/roleHelper";

const API_BASE = "http://localhost:8000/user-management";

const UserManagement = () => {
  const currentUser = getStoredUser();
  const [activeTab, setActiveTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [editingStudent, setEditingStudent] = useState(null);
  const [mappingFaculty, setMappingFaculty] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form States
  const [userData, setUserData] = useState({ name: "", email: "", password: "", role: "student", identifier: "" });
  const [newDept, setNewDept] = useState({ name: "", description: "" });
  const [newClass, setNewClass] = useState({ department_id: "", name: "", year: "" });
  const [newMapping, setNewMapping] = useState({ department_id: "", class_id: "", is_incharge: false });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const deptsRes = await axios.get(`${API_BASE}/departments`);
      setDepartments(deptsRes.data);
      
      const classesRes = await axios.get(`${API_BASE}/class-rooms`);
      setClasses(classesRes.data);

      if (activeTab === "students") {
        const res = await axios.get(`${API_BASE}/students?user_id=${currentUser.id}`);
        setStudents(res.data);
      } else if (activeTab === "faculty") {
        const res = await axios.get(`${API_BASE}/faculty?user_id=${currentUser.id}`);
        setFaculties(res.data);
      } else if (activeTab === "admins") {
        const res = await axios.get(`${API_BASE}/admins?user_id=${currentUser.id}`);
        setAdmins(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_BASE}/students/${editingStudent.id}?user_id=${currentUser.id}`, editingStudent);
      setEditingStudent(null);
      fetchData();
      if (currentUser.role === "super_admin") {
        const adRes = await axios.get(`${API_BASE}/admins?user_id=${currentUser.id}`);
        setAdmins(adRes.data);
      }
    } catch (err) {
      alert("Update failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateDept = async () => {
    try {
      await axios.post(`${API_BASE}/departments?user_id=${currentUser.id}`, newDept);
      setShowDeptModal(false);
      setNewDept({ name: "", description: "" });
      fetchData();
    } catch (err) {
      alert("Failed to create department");
    }
  };

  const handleCreateClass = async () => {
    try {
      await axios.post(`${API_BASE}/class-rooms?user_id=${currentUser.id}`, newClass);
      setShowClassModal(false);
      setNewClass({ department_id: "", name: "", year: "" });
      fetchData();
    } catch (err) {
      alert("Failed to create class");
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/users?user_id=${currentUser.id}`, userData);
      setShowUserModal(false);
      setUserData({ name: "", email: "", password: "", role: "student", identifier: "" });
      fetchData();
    } catch (err) {
      alert("Creation failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_BASE}/users/${editingUser.id}?user_id=${currentUser.id}`, userData);
      setEditingUser(null);
      setShowUserModal(false);
      setUserData({ name: "", email: "", password: "", role: "student", identifier: "" });
      fetchData();
    } catch (err) {
      alert("Update failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const openEditUser = (user, role) => {
    setEditingUser(user);
    setUserData({
      name: user.name,
      email: user.email,
      password: "", // Keep blank for no change
      role: role,
      identifier: user.identifier || (user.data?.identifier) || ""
    });
    setShowUserModal(true);
  };

  const handleMapFaculty = async () => {
    try {
      await axios.post(`${API_BASE}/faculty-mappings?user_id=${currentUser.id}`, {
        ...newMapping,
        department_id: parseInt(newMapping.department_id),
        class_id: newMapping.class_id ? parseInt(newMapping.class_id) : null,
        user_id: mappingFaculty.id
      });
      setMappingFaculty(null);
      setNewMapping({ department_id: "", class_id: "", is_incharge: false });
      fetchData();
    } catch (err) {
      alert("Mapping failed: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--erp-bg)] pt-24 px-6 pb-12 erp-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-600">Admin Module</p>
            <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">User Management</h1>
            <p className="text-slate-600 mt-3 text-sm font-medium">Manage academic hierarchy, faculty assignments, and student profiles.</p>
          </div>
          <div className="flex gap-4">
            {currentUser.role === "super_admin" && (
              <button 
                onClick={() => setShowDeptModal(true)} 
                className="erp-pill-button px-6 py-3 shadow-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                Department
              </button>
            )}
            {(currentUser.role === "super_admin" || currentUser.role === "admin") && (
              <button 
                onClick={() => setShowClassModal(true)} 
                className="erp-pill-button px-6 py-3 shadow-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                Class Room
              </button>
            )}
            {(currentUser.role === "super_admin" || currentUser.role === "admin") && (
              <button 
                onClick={() => {
                  setEditingUser(null);
                  let defaultRole = 'student';
                  if (activeTab === 'faculty') defaultRole = 'faculty';
                  if (activeTab === 'admins') defaultRole = 'admin';
                  setUserData({ name: "", email: "", password: "", role: defaultRole, identifier: "" });
                  setShowUserModal(true);
                }} 
                className="erp-pill-button px-6 py-3 bg-[var(--erp-primary)] text-white border-transparent hover:brightness-110 shadow-lg shadow-blue-100"
                style={{ background: 'var(--erp-primary)', color: 'white' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                Add {activeTab === 'faculty' ? 'Faculty' : activeTab === 'admins' ? 'Admin' : 'Student'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-[var(--erp-surface-strong)] p-1.5 rounded-[2rem] border border-[var(--erp-border)] shadow-sm mb-10 w-fit">
          {["students", "faculty", ...(currentUser.role === "super_admin" ? ["admins"] : []), "setup"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all ${activeTab === tab ? 'bg-[var(--erp-primary)] text-white shadow-lg' : 'text-[var(--erp-muted)] hover:bg-white/50'}`}
              style={activeTab === tab ? { background: 'var(--erp-primary)' } : {}}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-[var(--erp-primary-soft)] border-t-[var(--erp-primary)] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="erp-card rounded-[3rem] overflow-hidden">
            {activeTab === "students" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-8 py-5 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Student Info</th>
                      <th className="px-8 py-5 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Academic Details</th>
                      <th className="px-8 py-5 text-xs font-bold uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--erp-border)]">
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-[var(--erp-surface-soft)] transition-colors group">
                        <td className="px-8 py-5">
                            <p className="font-bold text-[var(--erp-text)]">{student.name}</p>
                            <p className="text-xs text-[var(--erp-muted)] font-medium">ID: {student.data?.identifier || "N/A"} • {student.email}</p>
                        </td>
                        <td className="px-8 py-5">
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-100 uppercase tracking-wider">{student.department || "No Dept"}</span>
                                <span className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-[10px] font-bold border border-teal-100 uppercase tracking-wider">{student.class || "No Class"}</span>
                                {student.year && <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold border border-slate-200 uppercase tracking-wider">Year {student.year}</span>}
                            </div>
                        </td>
                        <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditUser(student, 'student')} 
                            className="p-3 text-[var(--erp-primary)] hover:bg-[var(--erp-primary-soft)] rounded-2xl transition-all"
                            title="Edit User Credentials"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <button 
                            onClick={() => setEditingStudent(student)} 
                            className="p-3 text-teal-600 hover:bg-teal-50 rounded-2xl transition-all"
                            title="Edit Academic Details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "faculty" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[var(--erp-surface-soft)] border-b border-[var(--erp-border)]">
                    <tr>
                      <th className="px-8 py-5 erp-section-title">Faculty Info</th>
                      <th className="px-8 py-5 erp-section-title">Assigned Units</th>
                      <th className="px-8 py-5 erp-section-title text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--erp-border)]">
                    {faculties.map(faculty => (
                      <tr key={faculty.id} className="hover:bg-[var(--erp-surface-soft)] transition-colors">
                        <td className="px-8 py-5">
                          <p className="font-bold text-[var(--erp-text)]">{faculty.name}</p>
                          <p className="text-xs text-[var(--erp-muted)] font-medium">ID: {faculty.identifier || "N/A"} • {faculty.email}</p>
                        </td>
                        <td className="px-8 py-5 flex flex-wrap gap-2">
                          {faculty.mappings.map((m, i) => (
                            <div key={i} className={`px-3 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-wider flex items-center gap-2 ${m.incharge ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm' : 'bg-white border-[var(--erp-border)] text-[var(--erp-muted)]'}`}>
                              {m.incharge && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>}
                              {m.dept} • {m.class}
                            </div>
                          ))}
                          {faculty.mappings.length === 0 && <span className="text-xs text-[var(--erp-muted)] italic font-medium">No active mappings</span>}
                        </td>
                        <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                          {(currentUser.role === "admin" || currentUser.role === "super_admin") && (
                            <>
                              <button 
                                onClick={() => openEditUser(faculty, 'faculty')} 
                                className="p-3 text-[var(--erp-primary)] hover:bg-[var(--erp-primary-soft)] rounded-2xl transition-all"
                                title="Edit Credentials"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </button>
                              <button 
                                  onClick={() => setMappingFaculty(faculty)} 
                                  className="erp-pill-button px-4 py-2 text-[10px] uppercase tracking-widest shadow-sm"
                              >
                                Mapping
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "admins" && (
              <div className="p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {admins.map(a => (
                  <div key={a.id} className="erp-card p-8 rounded-[3rem] shadow-sm hover:shadow-xl transition-all erp-rise-in group">
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                        <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <h4 className="text-xl font-black text-slate-900">{a.name}</h4>
                    <p className="text-sm font-bold text-slate-500 mb-6">{a.email}</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                        <button onClick={() => openEditUser(a, 'admin')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Edit</button>
                    </div>
                  </div>
                ))}
                {admins.length === 0 && <p className="col-span-full text-center py-20 text-slate-400 font-bold italic">No admins created yet.</p>}
              </div>
            )}
            
            {activeTab === "setup" && (
              <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-[var(--erp-text)] flex items-center gap-3">
                      <div className="w-2.5 h-8 bg-blue-500 rounded-full"></div>
                      Departments
                    </h3>
                    <button onClick={() => setShowDeptModal(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {departments.map(d => (
                      <div key={d.id} className="p-6 bg-[var(--erp-surface-soft)] rounded-[2rem] border border-[var(--erp-border)] shadow-sm erp-rise-in">
                        <p className="font-extrabold text-[var(--erp-text)] mb-1">{d.name}</p>
                        <p className="text-sm text-[var(--erp-muted)] font-medium">{d.description || "Official college department."}</p>
                      </div>
                    ))}
                    {departments.length === 0 && <p className="text-[var(--erp-muted)] font-medium italic">No departments created yet.</p>}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-[var(--erp-text)] flex items-center gap-3">
                      <div className="w-2.5 h-8 bg-teal-500 rounded-full"></div>
                      Class Rooms
                    </h3>
                    <button onClick={() => setShowClassModal(true)} className="p-2 text-teal-600 hover:bg-teal-50 rounded-xl transition-all">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {classes.map(c => (
                      <div key={c.id} className="p-6 bg-[var(--erp-surface-soft)] rounded-[2rem] border border-[var(--erp-border)] flex items-center justify-between shadow-sm erp-rise-in">
                        <div>
                          <p className="font-extrabold text-[var(--erp-text)]">{c.name}</p>
                          <p className="text-[10px] font-black text-[var(--erp-primary)] uppercase tracking-widest mt-1">
                            {departments.find(d => d.id === c.department_id)?.name} • Year {c.year}
                          </p>
                        </div>
                        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-[var(--erp-primary)] font-black text-xs border border-[var(--erp-border)] shadow-sm">
                            Y{c.year}
                        </div>
                      </div>
                    ))}
                    {classes.length === 0 && <p className="text-[var(--erp-muted)] font-medium italic">No classes created yet.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <form onSubmit={handleUpdateStudent} className="erp-card rounded-[3.5rem] p-10 w-full max-w-lg shadow-[0_40px_100px_rgba(0,0,0,0.2)] overflow-y-auto max-h-[90vh] erp-rise-in">
            <h3 className="text-3xl font-black text-[var(--erp-text)] mb-8 tracking-tight">Edit Profile</h3>
            <div className="space-y-6">
              <div>
                <label className="erp-section-title px-1 mb-2 block">Student Name</label>
                <input type="text" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-[var(--erp-primary-soft)] transition-all font-bold text-[var(--erp-text)]" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="erp-section-title px-1 mb-2 block">Department</label>
                  <select 
                    disabled={currentUser.role === "faculty"}
                    value={editingStudent.department_id || ""} 
                    onChange={e => setEditingStudent({...editingStudent, department_id: e.target.value})} 
                    className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-[var(--erp-primary-soft)] transition-all font-bold text-[var(--erp-text)] disabled:opacity-50"
                  >
                    <option value="">Select Dept</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="erp-section-title px-1 mb-2 block">Current Year</label>
                  <select value={editingStudent.year || ""} onChange={e => setEditingStudent({...editingStudent, year: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-[var(--erp-primary-soft)] transition-all font-bold text-[var(--erp-text)]">
                    <option value="">Select Year</option>
                    {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="erp-section-title px-1 mb-2 block">Class Section</label>
                <select value={editingStudent.class_id || ""} onChange={e => setEditingStudent({...editingStudent, class_id: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-[var(--erp-primary-soft)] transition-all font-bold text-[var(--erp-text)]">
                  <option value="">Select Class</option>
                  {classes.filter(c => !editingStudent.department_id || c.department_id == editingStudent.department_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-4 mt-12">
              <button type="button" onClick={() => setEditingStudent(null)} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button type="submit" className="erp-pill-button flex-1 py-4 bg-[var(--erp-primary)] text-white border-transparent shadow-lg shadow-blue-100" style={{ background: 'var(--erp-primary)', color: 'white' }}>Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Mapping Faculty Modal */}
      {mappingFaculty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <div className="erp-card rounded-[3.5rem] p-10 w-full max-w-lg shadow-2xl erp-rise-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-[var(--erp-text)] mb-2">Manage Assignments</h3>
            <p className="text-sm font-medium text-[var(--erp-muted)] mb-8">Current mappings for <span className="text-[var(--erp-primary)] font-bold">{mappingFaculty.name}</span></p>
            
            {/* Current Mappings List */}
            <div className="space-y-3 mb-10">
              {mappingFaculty.mappings.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-[var(--erp-surface-soft)] rounded-2xl border border-[var(--erp-border)]">
                  <div>
                    <p className="font-bold text-xs uppercase tracking-wider text-[var(--erp-text)]">{m.dept} • {m.class}</p>
                    {m.incharge && <span className="text-[10px] font-black text-orange-600 uppercase">Class Incharge</span>}
                  </div>
                  <button 
                    onClick={async () => {
                      if (window.confirm("Remove this assignment?")) {
                        await axios.delete(`${API_BASE}/faculty-mappings/${m.id}?user_id=${currentUser.id}`);
                        setMappingFaculty(null);
                        fetchData();
                      }
                    }} 
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              ))}
              {mappingFaculty.mappings.length === 0 && <p className="text-xs text-[var(--erp-muted)] italic text-center py-4">No active mappings</p>}
            </div>

            <div className="border-t border-[var(--erp-border)] pt-8 space-y-6">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--erp-muted)]">Add New Assignment</p>
              <div>
                <label className="erp-section-title px-1 mb-2 block">Department</label>
                <select onChange={e => setNewMapping({...newMapping, department_id: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]">
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="erp-section-title px-1 mb-2 block">Class (Optional)</label>
                <select onChange={e => setNewMapping({...newMapping, class_id: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]">
                  <option value="">All Classes in Dept</option>
                  {classes.filter(c => !newMapping.department_id || c.department_id == newMapping.department_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-4 px-3 py-4 bg-[var(--erp-surface-soft)] rounded-2xl border border-[var(--erp-border)] cursor-pointer group">
                <input type="checkbox" checked={newMapping.is_incharge} onChange={e => setNewMapping({...newMapping, is_incharge: e.target.checked})} className="w-6 h-6 rounded-lg border-[var(--erp-border)] text-[var(--erp-primary)] focus:ring-[var(--erp-primary-soft)]" />
                <span className="text-xs font-black text-[var(--erp-text)] uppercase tracking-widest group-hover:text-[var(--erp-primary)] transition-colors">Assign as Class Incharge</span>
              </label>
            </div>

            <div className="flex gap-4 mt-12">
              <button onClick={() => setMappingFaculty(null)} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button onClick={handleMapFaculty} className="erp-pill-button flex-1 py-4 bg-[var(--erp-primary)] text-white border-transparent" style={{ background: 'var(--erp-primary)', color: 'white' }}>Save Assignment</button>
            </div>
          </div>
        </div>
      )}

      {/* Dept Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <div className="erp-card rounded-[3.5rem] p-10 w-full max-w-md shadow-2xl erp-rise-in">
            <h3 className="text-2xl font-black text-[var(--erp-text)] mb-8">New Department</h3>
            <div className="space-y-6">
              <input placeholder="e.g. Computer Science" value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]" />
              <textarea placeholder="Dept description..." value={newDept.description} onChange={e => setNewDept({...newDept, description: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)] h-32" />
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowDeptModal(false)} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button onClick={handleCreateDept} className="erp-pill-button flex-1 py-4 bg-[var(--erp-primary)] text-white border-transparent" style={{ background: 'var(--erp-primary)', color: 'white' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal (Create/Edit) */}
      {showUserModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="erp-card rounded-[3.5rem] p-10 w-full max-w-md shadow-2xl erp-rise-in">
            <h3 className="text-2xl font-black text-[var(--erp-text)] mb-8">{editingUser ? 'Edit' : 'Create'} {userData.role === 'faculty' ? 'Faculty' : userData.role === 'admin' ? 'Admin' : 'Student'}</h3>
            <div className="space-y-5">
              <div>
                <label className="erp-section-title px-1 mb-2 block">Account Role</label>
                <select 
                  value={userData.role} 
                  onChange={e => setUserData({...userData, role: e.target.value})} 
                  className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]"
                  disabled={currentUser.role !== "super_admin"}
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  {currentUser.role === "super_admin" && <option value="admin">Admin</option>}
                </select>
              </div>
              <div>
                <label className="erp-section-title px-1 mb-2 block">Full Name</label>
                <input required placeholder="Name" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]" />
              </div>
              <div>
                <label className="erp-section-title px-1 mb-2 block">Email Address</label>
                <input required type="email" placeholder="email@college.edu" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]" />
              </div>
              <div>
                <label className="erp-section-title px-1 mb-2 block">{userData.role === 'faculty' ? 'Faculty ID' : 'Roll Number / ID'}</label>
                <input required placeholder="e.g. FAC101" value={userData.identifier} onChange={e => setUserData({...userData, identifier: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]" />
              </div>
              <div>
                <label className="erp-section-title px-1 mb-2 block">Password {editingUser && '(Leave blank to keep current)'}</label>
                <input required={!editingUser} type="password" placeholder="••••••••" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]" />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button type="button" onClick={() => setShowUserModal(false)} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button type="submit" className="erp-pill-button flex-1 py-4 bg-[var(--erp-primary)] text-white border-transparent" style={{ background: 'var(--erp-primary)', color: 'white' }}>{editingUser ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 erp-fade-in">
          <div className="erp-card rounded-[3.5rem] p-10 w-full max-w-md shadow-2xl erp-rise-in">
            <h3 className="text-2xl font-black text-[var(--erp-text)] mb-8">New Class Room</h3>
            <div className="space-y-6">
              <select value={newClass.department_id} onChange={e => setNewClass({...newClass, department_id: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]">
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input placeholder="Class Name (e.g. CSE-B)" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]" />
              <select value={newClass.year} onChange={e => setNewClass({...newClass, year: e.target.value})} className="w-full bg-[var(--erp-surface-soft)] border border-[var(--erp-border)] rounded-2xl px-6 py-4 font-bold text-[var(--erp-text)]">
                <option value="">Select Year</option>
                {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowClassModal(false)} className="erp-pill-button flex-1 py-4">Cancel</button>
              <button onClick={handleCreateClass} className="erp-pill-button flex-1 py-4 bg-[var(--erp-primary)] text-white border-transparent" style={{ background: 'var(--erp-primary)', color: 'white' }}>Create Class</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
;
};

export default UserManagement;
