import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getStoredUser } from '../utils/roleHelper';

const API_BASE = 'http://localhost:8000/ask-sb';

const MindmapNode = ({ node, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  return (
    <div
      className="flex items-start gap-12 relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Connection Line Hub for Children */}
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="absolute left-[200px] top-[26px] bottom-[26px] w-16">
           <div className="absolute inset-0 border-l-2 border-slate-200/50 rounded-l-3xl" />
        </div>
      )}

      <div className="flex flex-col items-start relative">
        {/* Incoming Horizontal Line */}
        {level > 0 && (
          <div className="absolute -left-16 top-[26px] w-16 h-0.5 bg-slate-200/50" />
        )}

        {/* Node Card */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(v => !v);
          }}
          className={`relative z-10 w-[200px] p-5 rounded-[2rem] border cursor-pointer transition-all duration-300 hover:shadow-2xl active:scale-95 group ${
            level === 0 
              ? 'bg-slate-900 text-white border-slate-800 shadow-2xl' 
              : 'bg-white text-slate-900 border-slate-100 shadow-lg hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${level === 0 ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-500'}`}>
              {level === 0 ? 'Project Core' : `Concept L${level}`}
            </span>
            {node.children && node.children.length > 0 && (
              <div className={`w-6 h-6 rounded-xl flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-blue-600 text-white rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                {isExpanded ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 12H4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
            )}
          </div>
          <h4 className="text-sm font-extrabold mt-2 leading-snug line-clamp-2">{node.name}</h4>
        </div>
      </div>

      {/* Children Container */}
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="flex flex-col gap-8">
          {node.children.map((child, i) => (
            <MindmapNode key={i} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const AskSB = () => {
  const user = getStoredUser();
  const mindmapContainerRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [sources, setSources] = useState([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [mindmapData, setMindmapData] = useState(null);
  const [quizData, setQuizData] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [isMindmapFullscreen, setIsMindmapFullscreen] = useState(false);
  
  const [leftWidth, setLeftWidth] = useState(300);
  const [midWidth, setMidWidth] = useState(500);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingMid, setIsResizingMid] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [departments, setDepartments] = useState([]);
  const [classRooms, setClassRooms] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    isUploading: false,
    progress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    remainingBytes: 0,
    speed: 0,
    estimatedTime: 0,
    fileName: ''
  });

  useEffect(() => {
    fetchProjects();
    if (user.role !== 'student') {
      fetchMetadata();
    }
  }, []);

  const fetchMetadata = async () => {
    try {
      const [dRes, cRes] = await Promise.all([
        axios.get(`http://localhost:8000/user-management/departments`),
        axios.get(`http://localhost:8000/user-management/class-rooms`)
      ]);
      setDepartments(dRes.data);
      setClassRooms(cRes.data);
    } catch (err) {
      console.error('Failed to fetch metadata', err);
    }
  };

  useEffect(() => {
    if (activeProject) {
      fetchProjectDetails(activeProject.id);
    }
  }, [activeProject]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const fetchProjects = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API_BASE}/projects?user_id=${user.id}`);
      setProjects(res.data);
      if (res.data.length > 0 && !activeProject) {
        setActiveProject(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const fetchProjectDetails = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/projects/${id}`);
      setHistory(res.data.chats);
      setSources(res.data.sources);
    } catch (err) {
      console.error('Failed to fetch project details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim() || !user?.id) return;
    try {
      const payload = { 
        user_id: user.id, 
        title: newProjectTitle,
        department_id: isShared ? selectedDept : null,
        class_id: isShared ? selectedClass : null
      };
      const res = await axios.post(`${API_BASE}/projects`, payload);
      setProjects(prev => [...prev, res.data]);
      setActiveProject(res.data);
      setNewProjectTitle('');
      setSelectedDept('');
      setSelectedClass('');
      setIsShared(false);
      setShowProjectModal(false);
    } catch (err) {
      alert('Failed to create project: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!user?.id) {
      alert('You must be logged in to delete projects.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await axios.delete(`${API_BASE}/projects/${id}?user_id=${user.id}`);
      const updatedProjects = projects.filter(p => p.id !== id);
      setProjects(updatedProjects);
      if (activeProject?.id === id) {
        setActiveProject(updatedProjects[0] || null);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      alert('Failed to delete project: ' + errorMsg);
      console.error('Delete project error:', err);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeProject || !user?.id) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    const startTime = Date.now();
    setUploadStatus(prev => ({ 
      ...prev, 
      isUploading: true, 
      fileName: file.name,
      totalBytes: file.size,
      progress: 0,
      uploadedBytes: 0,
      remainingBytes: file.size
    }));

    try {
      await axios.post(`${API_BASE}/projects/${activeProject.id}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const loaded = progressEvent.loaded;
          const total = progressEvent.total;
          const percent = Math.round((loaded * 100) / total);
          const timeElapsed = (Date.now() - startTime) / 1000; // seconds
          const speed = loaded / timeElapsed; // bytes per second
          const remainingBytes = total - loaded;
          const estimatedTime = speed > 0 ? remainingBytes / speed : 0;

          setUploadStatus(prev => ({
            ...prev,
            progress: percent,
            uploadedBytes: loaded,
            remainingBytes: remainingBytes,
            speed: speed,
            estimatedTime: estimatedTime
          }));
        }
      });
      fetchProjectDetails(activeProject.id);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploadStatus(prev => ({ ...prev, isUploading: false }));
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !activeProject || chatLoading || !user?.id) return;
    const userMsg = { role: 'user', content: message, created_at: new Date().toISOString() };
    setHistory(prev => [...prev, userMsg]);
    const currentMsg = message;
    setMessage('');
    setChatLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/projects/${activeProject.id}/chat`, {
        user_id: user.id,
        message: currentMsg,
      });
      setHistory(prev => [...prev, { role: 'ai', content: res.data.response, created_at: new Date().toISOString() }]);
    } catch (err) {
      alert('Chat failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setChatLoading(false);
    }
  };

  const fetchMindmap = async () => {
    if (!activeProject || sources.length === 0) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/projects/${activeProject.id}/mindmap`);
      setMindmapData(res.data);
    } catch (err) {
      alert('Failed to generate mindmap: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchQuiz = async () => {
    if (!activeProject || sources.length === 0) return;
    setQuizLoading(true);
    setQuizScore(null);
    setCurrentQuizIndex(0);
    try {
      const res = await axios.get(`${API_BASE}/projects/${activeProject.id}/quiz`);
      setQuizData(res.data);
    } catch (err) {
      alert('Failed to generate quiz: ' + (err.response?.data?.detail || err.message));
    } finally {
      setQuizLoading(false);
    }
  };

  const startResizingLeft = (e) => {
    setIsResizingLeft(true);
    e.preventDefault();
  };

  const startResizingMid = (e) => {
    setIsResizingMid(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft) {
        const newWidth = e.clientX - 24;
        if (newWidth > 200 && newWidth < 500) setLeftWidth(newWidth);
      }
      if (isResizingMid) {
        const newWidth = e.clientX - leftWidth - 24;
        if (newWidth > 300 && newWidth < 800) setMidWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingMid(false);
    };
    if (isResizingLeft || isResizingMid) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingMid, leftWidth]);

  useEffect(() => {
    const handleUp = () => {
      setIsResizingLeft(false);
      setIsResizingMid(false);
      setIsPanning(false);
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, []);

  const handleMindmapWheel = (e) => {
    if (activeTab !== 'mindmap') return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.2), 4);
    setZoom(newZoom);
  };

  const handleMindmapMouseDown = (e) => {
    if (activeTab !== 'mindmap') return;
    setIsPanning(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMindmapMouseMove = (e) => {
    if (!isPanning || activeTab !== 'mindmap') return;
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] pt-24 px-6 pb-6 overflow-hidden erp-fade-in text-slate-200">
      <div className="max-w-[1900px] mx-auto h-[calc(100vh-140px)] flex gap-4">
        
        {/* Panel 1: Projects & Sources */}
        <div style={{ width: leftWidth }} className="flex flex-col gap-4 flex-shrink-0 transition-all h-full">
          {/* Notebook Header & Limit */}
          <div className="bg-[#1e293b] rounded-[2rem] p-6 border border-slate-800 flex flex-col gap-4 flex-shrink-0">
             <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Notebook Pro</p>
                  <h2 className="text-xl font-black text-white mt-1">Ask SB</h2>
                  {(user.role === 'student' || user.role === 'faculty') && (
                    <div className="flex items-center gap-2 mt-2">
                       <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${projects.filter(p => p.user_id === user.id).length >= 2 ? 'bg-red-500' : 'bg-blue-500'}`} 
                            style={{ width: `${Math.min((projects.filter(p => p.user_id === user.id).length / 2) * 100, 100)}%` }}
                          />
                       </div>
                       <span className="text-[8px] font-bold text-slate-500">{projects.filter(p => p.user_id === user.id).length}/2 Personal</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowProjectModal(true)} className="p-3 bg-blue-600 text-white rounded-2xl hover:brightness-110 shadow-lg shadow-blue-900/20">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                </button>
             </div>
          </div>

          {/* Project List */}
          <div className="bg-[#1e293b] rounded-[2rem] flex-[1.5] overflow-hidden flex flex-col border border-slate-800 min-h-0">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Notebooks</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 erp-scrollbar">
               {projects.map(p => (
                 <div 
                   key={p.id} 
                   onClick={() => setActiveProject(p)}
                   className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${activeProject?.id === p.id ? 'bg-blue-600/10 border-blue-600 shadow-lg shadow-blue-900/10' : 'bg-[#0f172a]/50 border-slate-800 hover:border-slate-600'}`}
                 >
                    <div className="flex items-center gap-3 overflow-hidden">
                       <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${activeProject?.id === p.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                       </div>
                       <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-200 truncate">{p.title}</p>
                          {p.user_id !== user.id && <span className="text-[8px] font-black uppercase text-blue-400">Faculty Resource</span>}
                       </div>
                    </div>
                    {p.user_id === user.id && (
                      <button 
                        onClick={(e) => handleDeleteProject(p.id, e)} 
                        className="p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    )}
                 </div>
               ))}
               {projects.length === 0 && <p className="text-center py-10 text-[10px] font-black uppercase text-slate-500 tracking-widest">No Notebooks</p>}
            </div>
          </div>

          {/* Sources List */}
          <div className="bg-[#1e293b] rounded-[2rem] flex-1 overflow-hidden flex flex-col border border-slate-800 min-h-0">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Sources</span>
               {activeProject?.user_id === user.id && (
                 <button onClick={() => fileInputRef.current.click()} className="text-[10px] font-black uppercase text-blue-400 hover:text-blue-300">Add +</button>
               )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 erp-scrollbar">
              {sources.map(source => (
                <div key={source.id} className="p-4 bg-[#0f172a]/50 border border-slate-800 rounded-2xl hover:border-blue-500/50 transition-all group">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-blue-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2"/></svg>
                      </div>
                      <span className="text-xs font-bold truncate text-slate-300">{source.title}</span>
                   </div>
                </div>
              ))}
              {sources.length === 0 && <p className="text-center py-10 text-[10px] font-black uppercase text-slate-500 tracking-widest">No Sources</p>}
            </div>
          </div>
        </div>

        {/* Divider 1 */}
        <div 
          onMouseDown={startResizingLeft}
          className={`w-1 cursor-col-resize hover:bg-blue-500 transition-colors ${isResizingLeft ? 'bg-blue-600 w-1' : 'bg-slate-800'}`} 
        />

        {/* Panel 2: Chat */}
        <div 
          style={{ 
            width: isRightPanelVisible ? midWidth : 'auto', 
            flex: isRightPanelVisible ? 'none' : '1' 
          }} 
          className="flex flex-col flex-shrink-0 bg-[#1e293b] rounded-[2.5rem] border border-slate-800 overflow-hidden relative transition-all duration-300"
        >
           <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">AI Dialogue</h3>
                 {!isRightPanelVisible && (
                   <button 
                     onClick={() => setIsRightPanelVisible(true)}
                     className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                   >
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                     Show Mindmap
                   </button>
                 )}
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold text-slate-500">Gemini 1.5 Flash</span>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-8 space-y-8 erp-scrollbar">
              {history.map((chat, i) => (
                <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'} erp-rise-in`}>
                  <div className={`max-w-[90%] rounded-[2rem] px-6 py-4 shadow-xl ${chat.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#0f172a] text-slate-200 border border-slate-800'}`}>
                     <div className="prose prose-invert prose-sm max-w-none">
                        {chat.role === 'ai' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.content}</ReactMarkdown> : <p className="text-sm font-bold">{chat.content}</p>}
                     </div>
                  </div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="bg-slate-800 px-6 py-3 rounded-full animate-pulse text-[10px] font-black uppercase text-blue-400">AI Thinking...</div></div>}
              <div ref={chatEndRef} />
           </div>

           <div className="p-6 bg-[#0f172a]/50 backdrop-blur-xl border-t border-slate-800">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                 <input 
                   value={message} 
                   onChange={e => setMessage(e.target.value)} 
                   placeholder="Ask your notebook..." 
                   className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none"
                 />
                 <button type="submit" className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l7-7-7-7M5 12h14" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                 </button>
              </form>
           </div>
        </div>

        {/* Divider 2 */}
        {isRightPanelVisible && (
          <div 
            onMouseDown={startResizingMid}
            className={`w-1 cursor-col-resize hover:bg-blue-500 transition-colors ${isResizingMid ? 'bg-blue-600 w-1' : 'bg-slate-800'}`} 
          />
        )}

        {/* Panel 3: Mindmap / Quiz */}
        {isRightPanelVisible && (
          <div className="flex-1 bg-[#1e293b] rounded-[2.5rem] border border-slate-800 overflow-hidden flex flex-col relative erp-fade-in">
             <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#1e293b]/50">
                <div className="flex gap-4">
                   {['mindmap', 'quiz'].map(tab => (
                     <button 
                       key={tab} 
                       onClick={() => {
                          setActiveTab(tab);
                          if (tab === 'mindmap' && !mindmapData) fetchMindmap();
                          if (tab === 'quiz' && quizData.length === 0) fetchQuiz();
                       }}
                       className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                       {tab}
                     </button>
                   ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        mindmapContainerRef.current?.requestFullscreen();
                      } else {
                        document.exitFullscreen();
                      }
                    }}
                    className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-white"
                    title="Fullscreen"
                  >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    onClick={() => setIsRightPanelVisible(false)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors text-slate-500"
                    title="Hide Panel"
                  >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
             </div>

           <div 
             ref={mindmapContainerRef}
             className="flex-1 overflow-hidden relative bg-[#0a1022] select-none"
           >
              {isMindmapFullscreen && (
                <button onClick={() => setIsMindmapFullscreen(false)} className="absolute top-8 right-8 p-4 bg-slate-800 text-white rounded-2xl z-[201]">Exit Fullscreen</button>
              )}

              {activeTab === 'mindmap' && (
                <>
                  {/* Navigation Controls Overlay */}
                  <div className="absolute bottom-6 left-6 z-[10] flex flex-col gap-2">
                    <button onClick={() => setZoom(z => Math.min(z + 0.2, 4))} className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg">+</button>
                    <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.2))} className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg">-</button>
                    <button onClick={() => { setPan({x:0, y:0}); setZoom(1); }} className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" strokeWidth="2"/><path d="M12 8v8m-4-4h8" strokeWidth="2"/></svg>
                    </button>
                  </div>
                  
                  <div 
                    onWheelCapture={handleMindmapWheel}
                    onMouseDown={handleMindmapMouseDown}
                    onMouseMove={handleMindmapMouseMove}
                    className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                    style={{ 
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: isPanning ? 'none' : 'transform 0.1s ease-out'
                    }}
                  >
                    {mindmapData ? <MindmapNode node={mindmapData} /> : <div className="text-center font-black uppercase text-slate-600 tracking-widest text-[10px]">Generating Blueprint...</div>}
                  </div>
                </>
              )}

              {activeTab === 'quiz' && (
                <div className="w-full h-full overflow-y-auto p-12 erp-scrollbar flex flex-col items-center">
                    {quizData.length > 0 ? (
                    <div className="max-w-xl w-full erp-rise-in py-10">
                        <h4 className="text-xl font-black mb-8 text-center text-white">{quizData[currentQuizIndex].question}</h4>
                        <div className="space-y-4">
                            {quizData[currentQuizIndex].options.map((opt, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => {
                                    if (opt !== quizData[currentQuizIndex].answer) alert(`Incorrect!\n\n${quizData[currentQuizIndex].explanation}`);
                                    if (currentQuizIndex < quizData.length - 1) setCurrentQuizIndex(currentQuizIndex + 1);
                                    else alert('🎉 Quiz Complete! You finished all questions.');
                                }}
                                className="w-full text-left p-5 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-blue-600 transition-all font-bold text-slate-300"
                            >
                                {opt}
                            </button>
                            ))}
                        </div>
                    </div>
                    ) : <div className="mt-20 text-center font-black uppercase text-slate-600 tracking-widest text-[10px]">Generating Quiz...</div>}
                </div>
              )}
           </div>
        </div>
      )}

      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md erp-fade-in">
          <div className="bg-[#1e293b] rounded-[3rem] p-10 w-full max-w-md border border-slate-800 shadow-2xl erp-rise-in">
            <h3 className="text-2xl font-black text-white mb-8 tracking-tight">Create Notebook</h3>
            
            <div className="space-y-6">
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Notebook Title</label>
                  <input 
                    autoFocus value={newProjectTitle} 
                    onChange={e => setNewProjectTitle(e.target.value)} 
                    placeholder="e.g. Science Class Notes"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>

               {user.role !== 'student' && (
                 <>
                    <div className="flex items-center justify-between px-2">
                       <span className="text-xs font-bold text-slate-300">Share with Students?</span>
                       <button 
                         onClick={() => setIsShared(!isShared)}
                         className={`w-12 h-6 rounded-full transition-all relative ${isShared ? 'bg-blue-600' : 'bg-slate-800'}`}
                       >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isShared ? 'right-1' : 'left-1'}`} />
                       </button>
                    </div>

                    {isShared && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Department</label>
                          <select 
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500"
                          >
                             <option value="">Select Dept</option>
                             {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Class</label>
                          <select 
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500"
                          >
                             <option value="">Select Class</option>
                             {classRooms.filter(c => !selectedDept || c.department_id === parseInt(selectedDept)).map(c => (
                               <option key={c.id} value={c.id}>{c.name}</option>
                             ))}
                          </select>
                        </div>
                      </div>
                    )}
                 </>
               )}
            </div>

            <div className="flex gap-4 mt-10">
               <button onClick={() => setShowProjectModal(false)} className="flex-1 py-4 text-sm font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
               <button onClick={handleCreateProject} className="flex-1 py-4 text-sm font-black bg-blue-600 text-white rounded-2xl hover:brightness-110">Create</button>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt" />

      {/* Upload Progress Overlay */}
      {uploadStatus.isUploading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm erp-fade-in p-6">
           <div className="bg-[#1e293b] border border-slate-800 rounded-[3rem] p-10 w-full max-w-xl shadow-2xl erp-rise-in">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Syncing Intelligence</p>
                    <h3 className="text-2xl font-black text-white mt-1">Uploading Source</h3>
                 </div>
                 <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <svg className="w-8 h-8 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                 </div>
              </div>

              <div className="space-y-8">
                 {/* File Info */}
                 <div className="flex items-center gap-4 bg-[#0f172a] p-5 rounded-3xl border border-slate-800/50">
                    <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2"/></svg>
                    </div>
                    <div className="overflow-hidden">
                       <p className="text-sm font-black text-white truncate">{uploadStatus.fileName}</p>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{formatBytes(uploadStatus.totalBytes)}</p>
                    </div>
                 </div>

                 {/* Progress Bar */}
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase text-slate-400">Completion</span>
                       <span className="text-xl font-black text-blue-400">{uploadStatus.progress}%</span>
                    </div>
                    <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-1">
                       <div 
                         className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-300 relative shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                         style={{ width: `${uploadStatus.progress}%` }}
                       >
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[progress-shine_1s_linear_infinite]" />
                       </div>
                    </div>
                 </div>

                 {/* Detailed Stats */}
                 <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800/50">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Uploaded</p>
                       <p className="text-xs font-bold text-slate-200">{formatBytes(uploadStatus.uploadedBytes)}</p>
                    </div>
                    <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800/50">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Remaining</p>
                       <p className="text-xs font-bold text-slate-200">{formatBytes(uploadStatus.remainingBytes)}</p>
                    </div>
                    <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800/50">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Est. Time</p>
                       <p className="text-xs font-bold text-blue-400">
                          {uploadStatus.estimatedTime > 60 
                            ? `${Math.floor(uploadStatus.estimatedTime / 60)}m ${Math.round(uploadStatus.estimatedTime % 60)}s` 
                            : `${Math.round(uploadStatus.estimatedTime)}s`}
                       </p>
                    </div>
                 </div>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-800/50 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Network Speed: {formatBytes(uploadStatus.speed)}/s</span>
                 </div>
                 <p className="text-[9px] font-black uppercase text-slate-600">Processing on local node...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AskSB;
