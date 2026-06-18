import { useState, useRef, useEffect } from "react";

/* ── Constants ─────────────────────────────────── */
const DEPARTMENTS = ["Computer Science","Engineering","Business Administration","Medicine","Law","Architecture"];
const LEVELS = ["100","200","300","400","500"];
const DEPT_COLORS = {
  "Computer Science":"#22d3ee","Engineering":"#f59e0b",
  "Business Administration":"#34d399","Medicine":"#f87171",
  "Law":"#a78bfa","Architecture":"#fb923c"
};
const PALETTE = ["#22d3ee","#f59e0b","#34d399","#f87171","#a78bfa","#fb923c","#38bdf8","#4ade80"];

const getInitials = n => n.split(" ").map(p=>p[0]).join("").toUpperCase().slice(0,2);
const getColor   = n => PALETTE[n.charCodeAt(0) % PALETTE.length];
const uid        = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const fmtDate    = d => { try { return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; } };

/* ── Seed data ─────────────────────────────────── */
const STUDENTS0 = [
  {id:"s1",name:"Amara Osei",trackNo:"CS/2021/001",department:"Computer Science",level:"300",photo:null,registeredAt:"2024-01-15T10:00:00Z"},
  {id:"s2",name:"Kwame Asante",trackNo:"ENG/2022/045",department:"Engineering",level:"200",photo:null,registeredAt:"2024-01-16T09:30:00Z"},
  {id:"s3",name:"Abena Mensah",trackNo:"BUS/2020/012",department:"Business Administration",level:"400",photo:null,registeredAt:"2024-01-17T11:00:00Z"},
  {id:"s4",name:"Kofi Boateng",trackNo:"MED/2021/088",department:"Medicine",level:"300",photo:null,registeredAt:"2024-01-18T08:45:00Z"},
  {id:"s5",name:"Efua Darko",trackNo:"CS/2023/023",department:"Computer Science",level:"100",photo:null,registeredAt:"2024-01-19T14:00:00Z"},
  {id:"s6",name:"Yaw Oppong",trackNo:"LAW/2019/007",department:"Law",level:"500",photo:null,registeredAt:"2024-01-20T10:15:00Z"},
  {id:"s7",name:"Akosua Frimpong",trackNo:"ARCH/2022/034",department:"Architecture",level:"200",photo:null,registeredAt:"2024-02-01T09:00:00Z"},
  {id:"s8",name:"Nana Acheampong",trackNo:"ENG/2020/056",department:"Engineering",level:"400",photo:null,registeredAt:"2024-02-02T10:30:00Z"},
  {id:"s9",name:"Ama Dankwa",trackNo:"CS/2022/067",department:"Computer Science",level:"200",photo:null,registeredAt:"2024-02-10T11:00:00Z"},
  {id:"s10",name:"Fiifi Mensah",trackNo:"MED/2020/031",department:"Medicine",level:"400",photo:null,registeredAt:"2024-02-15T09:00:00Z"},
];
const EVENTS0 = [
  {id:"e1",name:"Annual General Meeting",date:"2024-03-15",createdAt:"2024-03-15T09:00:00Z",attendance:["s1","s2","s4","s6","s7"]},
  {id:"e2",name:"Tech Symposium 2024",date:"2024-04-10",createdAt:"2024-04-10T08:00:00Z",attendance:["s1","s3","s5","s8","s9"]},
];

/* ── Sub-components ────────────────────────────── */
function Avatar({ s, size = 40, style = {} }) {
  const c = getColor(s.name);
  if (s.photo) return (
    <img src={s.photo} alt={s.name}
      style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${c}`,flexShrink:0,...style}}/>
  );
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:`${c}22`,border:`2px solid ${c}`,
      display:"flex",alignItems:"center",justifyContent:"center",color:c,fontWeight:700,
      fontSize:size*.35,fontFamily:"'Rajdhani',sans-serif",flexShrink:0,userSelect:"none",...style}}>
      {getInitials(s.name)}
    </div>
  );
}

function Badge({ dept }) {
  const c = DEPT_COLORS[dept] || "#22d3ee";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:`${c}15`,
      border:`1px solid ${c}40`,borderRadius:999,padding:"3px 9px",color:c,
      fontSize:11,fontWeight:600,whiteSpace:"nowrap",lineHeight:1.4}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:c,display:"inline-block",flexShrink:0}}/>
      {dept}
    </span>
  );
}

function ProfileModal({ student, events, onClose }) {
  const c = DEPT_COLORS[student.department] || "#22d3ee";
  const attended = events.filter(e => e.attendance.includes(student.id));

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",
      backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",
      zIndex:1000,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0d1526",border:`1px solid ${c}30`,
        borderRadius:18,padding:32,maxWidth:490,width:"100%",position:"relative",
        boxShadow:`0 0 90px ${c}15,0 24px 60px rgba(0,0,0,.6)`,maxHeight:"90vh",overflowY:"auto"}}>

        <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"#111827",
          border:"none",color:"#64748b",fontSize:13,cursor:"pointer",width:28,height:28,
          display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6}}>✕</button>

        {/* Header */}
        <div style={{display:"flex",alignItems:"flex-start",gap:20,marginBottom:24}}>
          <Avatar s={student} size={92}/>
          <div style={{flex:1,paddingTop:4}}>
            <h2 style={{fontFamily:"'Rajdhani',sans-serif",fontSize:27,fontWeight:700,
              color:"#f1f5f9",lineHeight:1.1,margin:"0 0 6px"}}>{student.name}</h2>
            <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:c,
              display:"block",marginBottom:10}}>{student.trackNo}</code>
            <Badge dept={student.department}/>
          </div>
        </div>

        {/* Info grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          {[["Level",`Level ${student.level}`],["Events Attended",attended.length],
            ["Registered",fmtDate(student.registeredAt)],["Status","Active"]
          ].map(([k,v]) => (
            <div key={k} style={{background:"#131c30",borderRadius:8,padding:"11px 14px",border:"1px solid #1e293b"}}>
              <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{k}</div>
              <div style={{color:"#e2e8f0",fontWeight:600,fontSize:14}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Event history */}
        {attended.length > 0 && (<>
          <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Event History</div>
          {attended.map(ev => (
            <div key={ev.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              background:"#131c30",borderRadius:6,padding:"9px 12px",border:"1px solid #1e293b",
              marginBottom:6,fontSize:13}}>
              <span style={{color:"#94a3b8"}}>{ev.name}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",color:"#475569",fontSize:11}}>{fmtDate(ev.date)}</span>
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
}

/* ── Main App ──────────────────────────────────── */
export default function App() {
  const [page, setPage]       = useState("register");
  const [students, setStudents] = useState(STUDENTS0);
  const [events, setEvents]   = useState(EVENTS0);

  // Camera
  const [camActive, setCamActive] = useState(false);
  const [photo, setPhoto]         = useState(null);
  const [camErr, setCamErr]       = useState(null);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef   = useRef(null);

  // Register form
  const [form, setForm]   = useState({name:"",trackNo:"",department:"",level:""});
  const [regOk, setRegOk] = useState(false);

  // Students page
  const [fDept, setFDept]   = useState("All");
  const [fLevel, setFLevel] = useState("All");
  const [search, setSearch] = useState("");
  const [viewS, setViewS]   = useState(null);

  // Attendance
  const [evForm, setEvForm]       = useState({name:"",date:""});
  const [activeEv, setActiveEv]   = useState(null);
  const [marked, setMarked]       = useState(new Set());
  const [attFDept, setAttFDept]   = useState("All");
  const [attDone, setAttDone]     = useState(false);

  // Records
  const [selRec, setSelRec] = useState(null);
  const [viewRS, setViewRS] = useState(null);

  /* camera */
  useEffect(() => {
    if (camActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camActive]);

  useEffect(() => {
    if (page !== "register") {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setCamActive(false);
    }
  }, [page]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const startCam = async () => {
    setCamErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}}});
      streamRef.current = s;
      setCamActive(true);
    } catch {
      setCamErr("Camera access denied. Please allow permissions or use the upload option.");
    }
  };

  const stopCam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamActive(false);
  };

  const capturePic = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    setPhoto(c.toDataURL("image/jpeg", .85));
    stopCam();
  };

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setPhoto(ev.target.result);
    r.readAsDataURL(f);
    e.target.value = "";
  };

  /* register */
  const doRegister = () => {
    if (!form.name || !form.trackNo || !form.department || !form.level) return;
    setStudents(p => [...p, {id:uid(), ...form, photo, registeredAt:new Date().toISOString()}]);
    setForm({name:"",trackNo:"",department:"",level:""});
    setPhoto(null); setRegOk(true);
    setTimeout(() => setRegOk(false), 3000);
  };

  /* attendance */
  const createEvent = () => {
    if (!evForm.name || !evForm.date) return;
    const ev = {id:uid(), ...evForm, createdAt:new Date().toISOString(), attendance:[]};
    setEvents(p => [...p, ev]);
    setActiveEv(ev); setMarked(new Set());
    setEvForm({name:"",date:""});
  };

  const saveAtt = () => {
    if (!activeEv) return;
    setEvents(p => p.map(e => e.id === activeEv.id ? {...e, attendance:[...marked]} : e));
    setActiveEv(null); setMarked(new Set());
    setAttDone(true);
    setTimeout(() => { setAttDone(false); setPage("records"); }, 1500);
  };

  /* derived */
  const filtSt = students.filter(s =>
    (fDept  === "All" || s.department === fDept) &&
    (fLevel === "All" || s.level      === fLevel) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.trackNo.toLowerCase().includes(search.toLowerCase()))
  );
  const attSt = students.filter(s => attFDept === "All" || s.department === attFDept);

  /* shared styles */
  const inp  = {width:"100%",background:"#0f1829",border:"1px solid #1e293b",borderRadius:8,padding:"10px 14px",color:"#e2e8f0",fontSize:14,outline:"none",fontFamily:"'DM Sans',sans-serif"};
  const sel  = {...inp,cursor:"pointer",WebkitAppearance:"none"};
  const lbl  = {display:"block",fontSize:10,color:"#475569",marginBottom:6,letterSpacing:1.5,textTransform:"uppercase",fontWeight:500};
  const btn  = {background:"#22d3ee",border:"none",borderRadius:8,padding:"11px 20px",color:"#080c14",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",letterSpacing:.5,transition:"opacity .15s"};
  const btnS = {background:"transparent",border:"1px solid #1e293b",borderRadius:8,padding:"10px 16px",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .15s"};
  const card = {background:"#0d1526",border:"1px solid #1e293b",borderRadius:12,padding:24};

  const NAV = [
    {id:"register",  icon:"⊕", label:"Register"},
    {id:"students",  icon:"◧", label:"Students"},
    {id:"attendance",icon:"✔", label:"Attendance"},
    {id:"records",   icon:"≡", label:"Records"},
  ];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#070b17",fontFamily:"'DM Sans',sans-serif",color:"#e2e8f0",fontSize:14}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#070b17}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px}
        input:focus,select:focus{border-color:#22d3ee !important;box-shadow:0 0 0 3px rgba(34,211,238,.1)}
        .hov:hover{background:#101e35 !important;border-color:#334155 !important}
        .hov-nav:hover{color:#94a3b8 !important;background:rgba(255,255,255,.03) !important}
        .btn-sec:hover{border-color:#334155 !important;color:#94a3b8 !important}
      `}</style>

      {/* ─── Sidebar ─── */}
      <aside style={{width:220,background:"#060a14",borderRight:"1px solid #0e1829",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0}}>
        <div style={{padding:"24px 20px 18px",borderBottom:"1px solid #0e1829"}}>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:19,fontWeight:700,color:"#22d3ee",letterSpacing:3}}>FACE·ATTEND</div>
          <div style={{fontSize:10,color:"#1e3a4d",letterSpacing:2,marginTop:3,textTransform:"uppercase"}}>Admin System</div>
        </div>

        <nav style={{padding:"14px 10px",flex:1}}>
          {NAV.map(({id,icon,label}) => {
            const a = page === id;
            return (
              <button key={id} onClick={() => setPage(id)} className={a?"":"hov-nav"} style={{
                width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 12px",
                background:a?"rgba(34,211,238,.07)":"transparent",
                border:a?"1px solid rgba(34,211,238,.18)":"1px solid transparent",
                borderRadius:8,cursor:"pointer",
                color:a?"#22d3ee":"#3d5166",fontSize:13,fontWeight:a?600:400,
                marginBottom:2,textAlign:"left",fontFamily:"'DM Sans',sans-serif",transition:"all .15s",
              }}>
                <span style={{fontSize:14,width:16,textAlign:"center",flexShrink:0}}>{icon}</span>
                <span style={{flex:1}}>{label}</span>
                {(id==="students"||id==="records") && (
                  <span style={{background:"#0d1829",borderRadius:999,padding:"1px 7px",fontSize:10,
                    color:"#334155",fontFamily:"'JetBrains Mono',monospace"}}>
                    {id==="students" ? students.length : events.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{padding:"14px 18px 22px",borderTop:"1px solid #0e1829"}}>
          <div style={{fontSize:10,color:"#1e3a4d",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Overview</div>
          {[["Students",students.length],["Departments",DEPARTMENTS.length],["Events",events.length]].map(([l,v]) => (
            <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:12}}>
              <span style={{color:"#2a3a50"}}>{l}</span>
              <span style={{color:"#334155",fontFamily:"'JetBrains Mono',monospace"}}>{v}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main style={{flex:1,overflowY:"auto",padding:"36px 40px",minWidth:0}}>

        {/* ═══ REGISTER PAGE ═══ */}
        {page === "register" && (
          <div>
            <div style={{marginBottom:28}}>
              <h1 style={{fontFamily:"'Rajdhani',sans-serif",fontSize:28,fontWeight:700,color:"#f1f5f9",letterSpacing:.5,marginBottom:4}}>Register Student</h1>
              <p style={{fontSize:13,color:"#475569"}}>Capture face photo and enter student information to enroll</p>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:22,maxWidth:860}}>

              {/* Camera card */}
              <div style={card}>
                <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:16}}>Face Capture</div>

                <div style={{width:"100%",aspectRatio:"4/3",background:"#0a1120",borderRadius:10,
                  border:"1px solid #111827",overflow:"hidden",position:"relative",
                  display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
                  {photo ? (
                    <img src={photo} alt="Captured" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  ) : camActive ? (
                    <video ref={videoRef} autoPlay playsInline muted
                      style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}}/>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"#1e3a4d",userSelect:"none"}}>
                      <div style={{width:60,height:60,borderRadius:"50%",border:"2px dashed #1e3a4d",
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>◉</div>
                      <span style={{fontSize:12,letterSpacing:.5}}>No camera active</span>
                    </div>
                  )}
                  {photo && (
                    <div style={{position:"absolute",top:10,right:10,background:"rgba(52,211,153,.12)",
                      border:"1px solid rgba(52,211,153,.4)",borderRadius:999,padding:"3px 10px",
                      fontSize:11,color:"#34d399",backdropFilter:"blur(4px)"}}>✓ Captured</div>
                  )}
                </div>

                <canvas ref={canvasRef} style={{display:"none"}}/>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>

                {camErr && (
                  <div style={{background:"rgba(248,113,113,.07)",border:"1px solid rgba(248,113,113,.25)",
                    borderRadius:6,padding:"8px 12px",color:"#f87171",fontSize:12,marginBottom:12,lineHeight:1.6}}>
                    {camErr}
                  </div>
                )}

                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {!photo && !camActive && <button onClick={startCam} style={{...btn,flex:1,fontSize:13}}>▶ Start Camera</button>}
                  {!photo && camActive  && <button onClick={capturePic} style={{...btn,flex:1,background:"#34d399",color:"#080c14",fontSize:13}}>◉ Capture</button>}
                  {photo                && <button onClick={() => { setPhoto(null); startCam(); }} style={{...btnS,flex:1}} className="btn-sec">↺ Retake</button>}
                  {camActive            && <button onClick={stopCam} style={btnS} className="btn-sec">✕ Stop</button>}
                  {!photo               && <button onClick={() => fileRef.current?.click()} style={btnS} className="btn-sec">↑ Upload</button>}
                </div>
              </div>

              {/* Form card */}
              <div style={card}>
                <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:16}}>Student Details</div>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <label style={lbl}>Full Name *</label>
                    <input style={inp} placeholder="e.g. Amara Osei" value={form.name}
                      onChange={e => setForm(f => ({...f, name:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={lbl}>Track / ID Number *</label>
                    <input style={{...inp,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} placeholder="e.g. CS/2024/001"
                      value={form.trackNo} onChange={e => setForm(f => ({...f, trackNo:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={lbl}>Department *</label>
                    <select style={sel} value={form.department} onChange={e => setForm(f => ({...f, department:e.target.value}))}>
                      <option value="">Select department…</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Level *</label>
                    <select style={sel} value={form.level} onChange={e => setForm(f => ({...f, level:e.target.value}))}>
                      <option value="">Select level…</option>
                      {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
                    </select>
                  </div>

                  {regOk && (
                    <div style={{background:"rgba(52,211,153,.07)",border:"1px solid rgba(52,211,153,.28)",
                      borderRadius:8,padding:"12px 14px",color:"#34d399",fontSize:13,fontWeight:500,
                      display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:16}}>✓</span> Student registered successfully!
                    </div>
                  )}

                  <button onClick={doRegister} style={{...btn,padding:"13px",fontSize:15,marginTop:4,
                    opacity:(!form.name||!form.trackNo||!form.department||!form.level)?0.4:1}}>
                    Register Student
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STUDENTS PAGE ═══ */}
        {page === "students" && (
          <div>
            <div style={{marginBottom:28}}>
              <h1 style={{fontFamily:"'Rajdhani',sans-serif",fontSize:28,fontWeight:700,color:"#f1f5f9",letterSpacing:.5,marginBottom:4}}>Student Database</h1>
              <p style={{fontSize:13,color:"#475569"}}>{students.length} students enrolled across {DEPARTMENTS.length} departments</p>
            </div>

            {/* Dept tiles */}
            <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
              {DEPARTMENTS.map(d => {
                const cnt = students.filter(s => s.department === d).length;
                if (!cnt) return null;
                const c = DEPT_COLORS[d] || "#22d3ee";
                const active = fDept === d;
                return (
                  <button key={d} onClick={() => setFDept(active ? "All" : d)} className="hov" style={{
                    background:active?`${c}10`:"#0d1526",border:`1px solid ${active?`${c}40`:"#1e293b"}`,
                    borderRadius:8,padding:"10px 14px",cursor:"pointer",textAlign:"left",transition:"all .15s",
                  }}>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,color:active?c:"#334155",marginBottom:2}}>{cnt}</div>
                    <div style={{fontSize:10,color:active?c:"#2a3a50",textTransform:"uppercase",letterSpacing:.5,maxWidth:90,lineHeight:1.4}}>{d}</div>
                  </button>
                );
              })}
            </div>

            {/* Filter row */}
            <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
              <input style={{...inp,maxWidth:240}} placeholder="Search name or track no…" value={search} onChange={e => setSearch(e.target.value)}/>
              <select style={{...sel,maxWidth:200}} value={fDept} onChange={e => setFDept(e.target.value)}>
                <option value="All">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
              <select style={{...sel,maxWidth:130}} value={fLevel} onChange={e => setFLevel(e.target.value)}>
                <option value="All">All Levels</option>
                {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
              </select>
              <span style={{fontSize:12,color:"#334155",marginLeft:"auto"}}>{filtSt.length} result{filtSt.length!==1?"s":""}</span>
            </div>

            {/* Grid */}
            {filtSt.length === 0 ? (
              <div style={{textAlign:"center",padding:60,color:"#1e3a4d",fontSize:14}}>No students match your filters</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(268px,1fr))",gap:12}}>
                {filtSt.map(s => (
                  <div key={s.id} className="hov" onClick={() => setViewS(s)} style={{
                    background:"#0d1526",border:"1px solid #111827",borderRadius:12,
                    padding:"17px 18px",cursor:"pointer",transition:"all .15s",
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                      <Avatar s={s} size={46}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:14,color:"#e2e8f0",marginBottom:2,
                          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</div>
                        <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#334155"}}>{s.trackNo}</code>
                      </div>
                      <span style={{fontSize:11,background:"#111827",borderRadius:999,padding:"2px 8px",color:"#2a3a50",flexShrink:0}}>L{s.level}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <Badge dept={s.department}/>
                      <span style={{fontSize:11,color:"#22d3ee",opacity:.7}}>View →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ ATTENDANCE PAGE ═══ */}
        {page === "attendance" && (
          <div>
            <div style={{marginBottom:28}}>
              <h1 style={{fontFamily:"'Rajdhani',sans-serif",fontSize:28,fontWeight:700,color:"#f1f5f9",letterSpacing:.5,marginBottom:4}}>Mark Attendance</h1>
              <p style={{fontSize:13,color:"#475569"}}>Create an event and tap students to mark them present</p>
            </div>

            {attDone && (
              <div style={{background:"rgba(52,211,153,.07)",border:"1px solid rgba(52,211,153,.28)",
                borderRadius:8,padding:"14px 18px",color:"#34d399",fontSize:14,marginBottom:20,
                display:"flex",alignItems:"center",gap:10}}>
                ✓ Attendance saved! Redirecting to records…
              </div>
            )}

            {!activeEv ? (
              <div style={{display:"grid",gridTemplateColumns:"minmax(300px,400px) 1fr",gap:24,maxWidth:860,alignItems:"start"}}>
                <div style={card}>
                  <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:18}}>Create New Event</div>
                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    <div>
                      <label style={lbl}>Event Name</label>
                      <input style={inp} placeholder="e.g. Orientation Week Meeting"
                        value={evForm.name} onChange={e => setEvForm(f => ({...f,name:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={lbl}>Date</label>
                      <input type="date" style={inp} value={evForm.date}
                        onChange={e => setEvForm(f => ({...f,date:e.target.value}))}/>
                    </div>
                    <button onClick={createEvent} style={{...btn,padding:"12px",opacity:(!evForm.name||!evForm.date)?0.4:1}}>
                      Create Event & Mark Attendance →
                    </button>
                  </div>
                </div>

                {events.length > 0 && (
                  <div>
                    <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Edit Existing Event</div>
                    {events.slice().reverse().map(ev => (
                      <div key={ev.id} className="hov" onClick={() => { setActiveEv(ev); setMarked(new Set(ev.attendance)); }} style={{
                        background:"#0d1526",border:"1px solid #111827",borderRadius:8,
                        padding:"14px 16px",cursor:"pointer",marginBottom:8,
                        display:"flex",justifyContent:"space-between",alignItems:"center",
                      }}>
                        <div>
                          <div style={{fontWeight:600,color:"#e2e8f0",marginBottom:3,fontSize:14}}>{ev.name}</div>
                          <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#334155"}}>{fmtDate(ev.date)}</code>
                        </div>
                        <span style={{background:"rgba(34,211,238,.07)",color:"#22d3ee",borderRadius:999,
                          padding:"3px 10px",fontSize:12,border:"1px solid rgba(34,211,238,.2)",flexShrink:0}}>
                          {ev.attendance.length} ✓
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Event bar */}
                <div style={{...card,marginBottom:18,display:"flex",justifyContent:"space-between",
                  alignItems:"center",flexWrap:"wrap",gap:12,padding:"16px 22px"}}>
                  <div>
                    <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:20,fontWeight:700,color:"#22d3ee"}}>{activeEv.name}</div>
                    <div style={{fontSize:12,color:"#3d5166",marginTop:2}}>
                      {fmtDate(activeEv.date)} · <span style={{color:"#22d3ee"}}>{marked.size}</span> / {attSt.length} present
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <select style={{...sel,width:"auto",fontSize:12}} value={attFDept} onChange={e => setAttFDept(e.target.value)}>
                      <option value="All">All Departments</option>
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <button onClick={() => setMarked(new Set(attSt.map(s=>s.id)))} style={btnS} className="btn-sec">All ✓</button>
                    <button onClick={() => setMarked(new Set())} style={btnS} className="btn-sec">Clear</button>
                    <button onClick={saveAtt} style={{...btn,background:"#34d399",color:"#080c14",fontSize:13}}>Save ✓</button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{background:"#111827",borderRadius:999,height:3,marginBottom:18,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"linear-gradient(90deg,#22d3ee,#34d399)",borderRadius:999,
                    transition:"width .3s",width:`${attSt.length?marked.size/attSt.length*100:0}%`}}/>
                </div>

                {/* Student checklist */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(238px,1fr))",gap:8}}>
                  {attSt.map(s => {
                    const ok = marked.has(s.id);
                    return (
                      <div key={s.id} onClick={() => setMarked(p => { const n=new Set(p); ok?n.delete(s.id):n.add(s.id); return n; })} style={{
                        background:ok?"rgba(52,211,153,.06)":"#0d1526",
                        border:`1px solid ${ok?"rgba(52,211,153,.28)":"#111827"}`,
                        borderRadius:10,padding:"12px 14px",cursor:"pointer",
                        display:"flex",alignItems:"center",gap:10,transition:"all .12s",
                      }}>
                        <Avatar s={s} size={38}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:13,color:ok?"#e2e8f0":"#94a3b8",
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</div>
                          <div style={{fontSize:10,color:"#2a3a50",fontFamily:"'JetBrains Mono',monospace"}}>{s.department.split(" ")[0]}</div>
                        </div>
                        <div style={{width:20,height:20,borderRadius:5,
                          border:`2px solid ${ok?"#34d399":"#1e293b"}`,
                          background:ok?"#34d399":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          color:"#080c14",fontSize:12,flexShrink:0,fontWeight:700,transition:"all .12s"}}>
                          {ok && "✓"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button onClick={() => { setActiveEv(null); setMarked(new Set()); }} style={{...btnS,marginTop:18,fontSize:12}} className="btn-sec">← Back</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ RECORDS PAGE ═══ */}
        {page === "records" && (
          <div>
            <div style={{marginBottom:28}}>
              <h1 style={{fontFamily:"'Rajdhani',sans-serif",fontSize:28,fontWeight:700,color:"#f1f5f9",letterSpacing:.5,marginBottom:4}}>Event Records</h1>
              <p style={{fontSize:13,color:"#475569"}}>Full attendance history · tap an event to view details</p>
            </div>

            {events.length === 0 ? (
              <div style={{...card,textAlign:"center",padding:60,color:"#1e3a4d"}}>
                <div style={{fontSize:40,marginBottom:14}}>≡</div>
                <div style={{marginBottom:18,fontSize:15}}>No events recorded yet</div>
                <button onClick={() => setPage("attendance")} style={btn}>Create First Event</button>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:selRec?"minmax(300px,1fr) minmax(300px,1fr)":"1fr",gap:20,alignItems:"start"}}>

                {/* Events list */}
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {events.slice().reverse().map(ev => {
                    const isA = selRec?.id === ev.id;
                    const pct = students.length ? Math.round(ev.attendance.length / students.length * 100) : 0;
                    return (
                      <div key={ev.id} className="hov" onClick={() => setSelRec(isA ? null : ev)} style={{
                        background:isA?"rgba(34,211,238,.05)":"#0d1526",
                        border:`1px solid ${isA?"rgba(34,211,238,.28)":"#111827"}`,
                        borderRadius:12,padding:"20px 22px",cursor:"pointer",transition:"all .15s",
                      }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                          <div>
                            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:18,fontWeight:700,
                              color:isA?"#22d3ee":"#e2e8f0",marginBottom:4}}>{ev.name}</div>
                            <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#334155"}}>{fmtDate(ev.date)}</code>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:isA?"#22d3ee":"#334155"}}>{ev.attendance.length}</div>
                            <div style={{fontSize:10,color:"#2a3a50",textTransform:"uppercase",letterSpacing:1}}>attended</div>
                          </div>
                        </div>
                        <div style={{background:"#111827",borderRadius:999,height:3,overflow:"hidden",marginBottom:6}}>
                          <div style={{height:"100%",background:isA?"#22d3ee":"#1e3a4d",borderRadius:999,width:`${pct}%`,transition:"width .5s"}}/>
                        </div>
                        <div style={{fontSize:11,color:"#2a3a50"}}>{pct}% of {students.length} students</div>
                      </div>
                    );
                  })}
                </div>

                {/* Detail panel */}
                {selRec && (
                  <div style={{...card,position:"sticky",top:20}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                      <div>
                        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:19,fontWeight:700,color:"#22d3ee",marginBottom:3}}>{selRec.name}</div>
                        <div style={{fontSize:12,color:"#3d5166"}}>{selRec.attendance.length} attended · {fmtDate(selRec.date)}</div>
                      </div>
                      <button onClick={() => setSelRec(null)} style={{background:"#111827",border:"none",color:"#475569",
                        cursor:"pointer",width:26,height:26,borderRadius:5,fontSize:13,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </div>

                    {/* Dept breakdown */}
                    <div style={{marginBottom:20}}>
                      <div style={{fontSize:10,color:"#334155",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>By Department</div>
                      {DEPARTMENTS.map(d => {
                        const tot = students.filter(s => s.department === d).length;
                        const att = selRec.attendance.filter(id => students.find(s => s.id === id && s.department === d)).length;
                        if (!tot) return null;
                        const c = DEPT_COLORS[d] || "#22d3ee";
                        return (
                          <div key={d} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                            <span style={{color:c,width:90,flexShrink:0,fontSize:11,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.split(" ")[0]}</span>
                            <div style={{flex:1,background:"#111827",borderRadius:999,height:3,overflow:"hidden"}}>
                              <div style={{height:"100%",background:c,borderRadius:999,width:`${tot?att/tot*100:0}%`,transition:"width .5s"}}/>
                            </div>
                            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#334155",
                              width:32,textAlign:"right",flexShrink:0}}>{att}/{tot}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{fontSize:10,color:"#334155",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Attendees</div>

                    <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:340,overflowY:"auto"}}>
                      {selRec.attendance.length === 0 ? (
                        <div style={{textAlign:"center",padding:20,color:"#1e3a4d",fontSize:13}}>No attendees recorded</div>
                      ) : (
                        selRec.attendance.map(id => {
                          const s = students.find(st => st.id === id);
                          if (!s) return null;
                          return (
                            <div key={id} style={{display:"flex",alignItems:"center",gap:10,background:"#0a1120",
                              borderRadius:8,padding:"9px 12px",border:"1px solid #111827"}}>
                              <Avatar s={s} size={34}/>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:600,fontSize:13,color:"#e2e8f0",
                                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</div>
                                <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#2a3a50"}}>{s.trackNo}</code>
                              </div>
                              <span style={{fontSize:10,background:"#111827",borderRadius:999,
                                padding:"2px 7px",color:"#334155",flexShrink:0}}>L{s.level}</span>
                              <button onClick={e => { e.stopPropagation(); setViewRS(s); }} style={{
                                background:"rgba(34,211,238,.07)",border:"1px solid rgba(34,211,238,.18)",
                                borderRadius:5,padding:"4px 10px",color:"#22d3ee",fontSize:11,
                                cursor:"pointer",flexShrink:0,fontFamily:"'DM Sans',sans-serif"}}>View</button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── Modals ─── */}
      {viewS  && <ProfileModal student={viewS}  events={events} onClose={() => setViewS(null)}/>}
      {viewRS && <ProfileModal student={viewRS} events={events} onClose={() => setViewRS(null)}/>}
    </div>
  );
}
