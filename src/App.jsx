import { useState, useCallback, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════
   CONSTANTES GLOBAIS
══════════════════════════════════════════════════════════ */
const DEFAULT_TPL = `Olá, {nome}! 👋\n\nVi o perfil de vocês e gostaria de apresentar uma oportunidade que pode ajudar no crescimento do negócio.\n\nPosso te enviar mais detalhes?`;

const STAGES = {
  novo:        { label: "🟢 Novo",        color: "#22d3a5", bg: "rgba(34,211,165,0.08)" },
  contatado:   { label: "🔵 Contatado",   color: "#38bdf8", bg: "rgba(56,189,248,0.08)" },
  interessado: { label: "🟡 Interessado", color: "#fbbf24", bg: "rgba(251,191,36,0.08)"  },
  negociando:  { label: "🟠 Negociando",  color: "#fb923c", bg: "rgba(251,146,60,0.08)"  },
  convertido:  { label: "🟣 Convertido",  color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  descartado:  { label: "⚫ Descartado",  color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

const DEMO_USER = { email: "demo@prospectai.com.br", pass: "prospect123" };

/* ═══════════════════════════════════════════════════════
   HELPERS & API (GOOGLE GEMINI)
══════════════════════════════════════════════════════════ */
const waLink = (p = "") => {
  const d = String(p).replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/55${d}` : null;
};

const buildMsg = (tpl, nome) => tpl.replace(/\{nome\}/g, nome);

// Função para obter a API Key de forma segura compatível com diversos ambientes
const getApiKey = () => {
  try {
    // Tenta primeiro o padrão do Vite (Vercel)
    if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
    // Fallback para o objeto import.meta com verificação de segurança para o compilador
    const meta = (import.meta);
    if (meta?.env?.VITE_GEMINI_API_KEY) return meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {
    // Silencioso: se falhar, retorna vazio para evitar crash no build
  }
  return ""; 
};

async function fetchWithRetry(url, options, maxRetries = 5) {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
}

async function buscarLeads(ramo, cidade, excluir = []) {
  const apiKey = getApiKey();
  
  const excStr = excluir.length ? `\nNão retorne: ${excluir.slice(0,20).join(", ")}.` : "";
  
  const prompt = `Encontre contatos reais de estabelecimentos do tipo "${ramo}" em "${cidade}", Brasil.${excStr}
Extraia: nome, whatsapp (com DDD) e URL do Instagram.
Retorne no máximo 10 resultados em formato JSON.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          resultados: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                nome: { type: "STRING" },
                whatsapp: { type: "STRING" },
                instagram: { type: "STRING" }
              },
              required: ["nome", "whatsapp", "instagram"]
            }
          }
        }
      }
    }
  };

  const data = await fetchWithRetry(url, {
    method: "POST", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("A IA não retornou dados.");
  
  try {
    return JSON.parse(text).resultados || [];
  } catch (err) {
    throw new Error("Erro ao processar lista de leads.");
  }
}

/* ═══════════════════════════════════════════════════════
   COMPONENTES DE UI
══════════════════════════════════════════════════════════ */
function MsgModal({ lead, template, onClose }) {
  const [copied, setCopied] = useState(false);
  const msg = buildMsg(template, lead.nome);
  const wa = lead.whatsapp ? waLink(lead.whatsapp) : null;
  
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e",border:"1px solid #1e3248",borderRadius:18,padding:28,width:450,maxWidth:"100%" }}>
        <div style={{ fontSize:18,fontWeight:800,marginBottom:20,color:"#e2eaf5" }}>{lead.nome}</div>
        <div style={{ background:"#005c4b",borderRadius:12,padding:16,fontSize:14,color:"#e9ffef",lineHeight:1.6,marginBottom:16,whiteSpace:"pre-wrap" }}>{msg}</div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={()=>{navigator.clipboard.writeText(msg); setCopied(true);}} style={{ flex:1,padding:12,borderRadius:10,border:"1px solid #1e3248",background:"transparent",color:copied?"#22d3a5":"#64748b",cursor:"pointer",fontWeight:700 }}>
            {copied?"✓ Copiado":"📋 Copiar"}
          </button>
          {wa && (
            <a href={`${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" style={{ flex:1,padding:12,borderRadius:10,background:"#25d366",color:"#000",textAlign:"center",textDecoration:"none",fontWeight:700 }}>
              WhatsApp
            </a>
          )}
        </div>
        <button onClick={onClose} style={{ width:"100%",marginTop:12,padding:8,background:"transparent",border:"none",color:"#475569",cursor:"pointer" }}>Fechar</button>
      </div>
    </div>
  );
}

function TemplateModal({ template, onClose, onSave }) {
  const [val, setVal] = useState(template);
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e",padding:24,borderRadius:16,width:500 }}>
        <h3 style={{ marginTop:0 }}>Template da Mensagem</h3>
        <textarea value={val} onChange={e=>setVal(e.target.value)} rows={6} style={{ width:"100%",background:"#0a1628",color:"#fff",padding:12,borderRadius:8,border:"1px solid #1e3248" }} />
        <p style={{ fontSize:12, color:"#64748b" }}>Use {"{nome}"} para personalizar.</p>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:10 }}>
          <button onClick={onClose} style={{ background:"transparent",color:"#64748b",border:"none" }}>Cancelar</button>
          <button onClick={()=>{onSave(val); onClose();}} style={{ background:"#22d3a5",color:"#000",padding:"8px 20px",borderRadius:8,border:"none",fontWeight:700 }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function CrmModal({ crm, onClose, onSave }) {
  const [stage, setStage] = useState(crm?.stage||"novo");
  const [notes, setNotes] = useState(crm?.notes||"");
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e",padding:24,borderRadius:16,width:400 }}>
        <h3 style={{ marginTop:0 }}>{crm.nome}</h3>
        <label style={{ display:"block",fontSize:12,color:"#64748b",marginBottom:4 }}>ESTÁGIO</label>
        <select value={stage} onChange={e=>setStage(e.target.value)} style={{ width:"100%",padding:10,background:"#0a1628",color:"#fff",borderRadius:8,marginBottom:16 }}>
          {Object.entries(STAGES).map(([k,s])=><option key={k} value={k}>{s.label}</option>)}
        </select>
        <label style={{ display:"block",fontSize:12,color:"#64748b",marginBottom:4 }}>NOTAS</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} style={{ width:"100%",background:"#0a1628",color:"#fff",padding:10,borderRadius:8 }} />
        <div style={{ display:"flex",justifyContent:"flex-end",gap:10,marginTop:16 }}>
          <button onClick={onClose} style={{ background:"transparent",color:"#64748b",border:"none" }}>Sair</button>
          <button onClick={()=>onSave(crm.id,stage,notes)} style={{ background:"#22d3a5",color:"#000",padding:"8px 20px",borderRadius:8,border:"none",fontWeight:700 }}>Gravar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PÁGINAS
══════════════════════════════════════════════════════════ */
function LandingPage({ onLogin }) {
  return (
    <div style={{ background:"#060f1a", color:"#e2eaf5", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:20 }}>
      <div style={{ width:60, height:60, background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", borderRadius:15, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, marginBottom:24 }}>🎯</div>
      <h1 style={{ fontSize:42, fontWeight:900, marginBottom:16 }}>ProspectAI Gemini</h1>
      <p style={{ fontSize:18, color:"#94a3b8", maxWidth:500, lineHeight:1.6, marginBottom:32 }}>A ferramenta definitiva para encontrar leads com WhatsApp e Instagram usando Inteligência Artificial.</p>
      <button onClick={onLogin} style={{ padding:"16px 48px", borderRadius:12, border:"none", background:"#22d3a5", color:"#000", fontSize:18, fontWeight:800, cursor:"pointer" }}>Começar Agora</button>
    </div>
  );
}

function LoginPage({ onSuccess, onBack }) {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const submit = () => {
    if (email.trim().toLowerCase() === DEMO_USER.email && pass === DEMO_USER.pass) {
      localStorage.setItem("prospectai_session", "true");
      onSuccess();
    } else { alert("Login incorreto. Use: demo@prospectai.com.br / prospect123"); }
  };
  return (
    <div style={{ background:"#060f1a", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#0f1c2e", padding:40, borderRadius:20, width:380 }}>
        <h2>Entrar</h2>
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:"100%", padding:12, marginBottom:12, borderRadius:8, background:"#0a1628", color:"white", border:"1px solid #1e3248" }} />
        <input type="password" placeholder="Senha" value={pass} onChange={e=>setPass(e.target.value)} style={{ width:"100%", padding:12, marginBottom:20, borderRadius:8, background:"#0a1628", color:"white", border:"1px solid #1e3248" }} />
        <button onClick={submit} style={{ width:"100%", padding:12, background:"#22d3a5", border:"none", borderRadius:8, fontWeight:800, cursor:"pointer" }}>Acessar</button>
        <button onClick={onBack} style={{ width:"100%", background:"transparent", border:"none", color:"#64748b", marginTop:16, cursor:"pointer" }}>Voltar</button>
      </div>
    </div>
  );
}

function MainApp({ onLogout }) {
  const [tab, setTab] = useState("prospector");
  const [ramo, setRamo] = useState("");
  const [cidade, setCidade] = useState("");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [msgLead, setMsgLead] = useState(null);
  const [showTpl, setShowTpl] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TPL);
  const [modalCrm, setModalCrm] = useState(null);
  const [crmLeads, setCrmLeads] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("prospectai_crm") || "[]");
    } catch { return []; }
  });

  useEffect(() => { 
    try { localStorage.setItem("prospectai_crm", JSON.stringify(crmLeads)); } catch {}
  }, [crmLeads]);

  const buscar = async () => {
    if (!ramo || !cidade) return;
    setLoading(true); setErro("");
    try {
      const res = await buscarLeads(ramo, cidade);
      setResultados(res);
    } catch (e) { setErro(e.message); }
    setLoading(false);
  };

  const addToCRM = (l) => {
    if (crmLeads.find(c => c.nome === l.nome)) return;
    setCrmLeads([...crmLeads, { ...l, id: Date.now(), stage: "novo", notes: "" }]);
  };

  return (
    <div style={{ background:"#060f1a", minHeight:"100vh", color:"#e2eaf5", padding:20 }}>
      <div style={{ maxWidth:1000, margin:"0 auto" }}>
        <header style={{ display:"flex", justifyContent:"space-between", marginBottom:30, alignItems:"center" }}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ width:32, height:32, background:"#22d3a5", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:"black", fontWeight:900 }}>P</div>
            <span style={{ fontWeight:800, fontSize:18 }}>ProspectAI</span>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setTab("prospector")} style={{ background:tab==="prospector"?"#22d3a5":"transparent", color:tab==="prospector"?"#000":"#64748b", padding:"8px 16px", borderRadius:8, border:"none", fontWeight:700, cursor:"pointer" }}>🔍 Buscar</button>
            <button onClick={()=>setTab("crm")} style={{ background:tab==="crm"?"#22d3a5":"transparent", color:tab==="crm"?"#000":"#64748b", padding:"8px 16px", borderRadius:8, border:"none", fontWeight:700, cursor:"pointer" }}>📊 CRM ({crmLeads.length})</button>
            <button onClick={onLogout} style={{ color:"#64748b", background:"transparent", border:"none", cursor:"pointer" }}>Sair</button>
          </div>
        </header>

        {tab === "prospector" ? (
          <div>
            <div style={{ background:"#0f1c2e", padding:20, borderRadius:16, display:"flex", gap:10, marginBottom:20 }}>
              <input placeholder="Ex: Pet Shop" value={ramo} onChange={e=>setRamo(e.target.value)} style={{ flex:1, padding:12, borderRadius:8, background:"#0a1628", color:"#fff", border:"1px solid #1e3248" }} />
              <input placeholder="Ex: São Paulo" value={cidade} onChange={e=>setCidade(e.target.value)} style={{ flex:1, padding:12, borderRadius:8, background:"#0a1628", color:"#fff", border:"1px solid #1e3248" }} />
              <button onClick={buscar} disabled={loading} style={{ background:"#22d3a5", color:"#000", padding:"0 24px", borderRadius:8, fontWeight:800, cursor:"pointer", opacity: loading?0.7:1 }}>
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
            {erro && <div style={{ background:"rgba(251,113,133,0.1)", border:"1px solid #fb7185", color:"#fb7185", padding:12, borderRadius:8, marginBottom:16 }}>{erro}</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {resultados.map((r, i) => (
                <div key={i} style={{ background:"#0f1c2e", padding:16, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"space-between", border:"1px solid #1e3248" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:16 }}>{r.nome}</div>
                    <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>{r.whatsapp || "Sem whats"} • {r.instagram || "Sem insta"}</div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={()=>setMsgLead(r)} style={{ background:"transparent", border:"1px solid #1e3248", color:"#64748b", padding:"8px 16px", borderRadius:8, cursor:"pointer" }}>Mensagem</button>
                    <button onClick={()=>addToCRM(r)} style={{ background:"#22d3a5", color:"#000", padding:"8px 16px", borderRadius:8, fontWeight:700, cursor:"pointer" }}>+ CRM</button>
                  </div>
                </div>
              ))}
              {!loading && resultados.length === 0 && <div style={{ textAlign:"center", padding:40, color:"#475569" }}>Faça uma busca para encontrar novos leads.</div>}
            </div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:15, alignItems:"start" }}>
             {Object.keys(STAGES).map(s => (
               <div key={s} style={{ background:"#0f1c2e", borderRadius:12, padding:12, minHeight:400, border:"1px solid #1e3248" }}>
                 <div style={{ color:STAGES[s].color, fontWeight:800, fontSize:12, marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
                   <span style={{ width:8, height:8, background:STAGES[s].color, borderRadius:"50%" }}></span>
                   {STAGES[s].label.split(" ")[1].toUpperCase()}
                 </div>
                 {crmLeads.filter(l => l.stage === s).map(l => (
                   <div key={l.id} onClick={()=>setModalCrm(l)} style={{ background:"#0a1628", padding:12, borderRadius:10, marginBottom:10, cursor:"pointer", border:`1px solid #1e3248`, transition:"transform 0.2s" }} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                     <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{l.nome}</div>
                     <div style={{ fontSize:11, color:"#64748b" }}>{l.whatsapp}</div>
                   </div>
                 ))}
               </div>
             ))}
          </div>
        )}
      </div>

      {msgLead && <MsgModal lead={msgLead} template={template} onClose={()=>setMsgLead(null)} />}
      {showTpl  && <TemplateModal template={template} onClose={()=>setShowTpl(false)} onSave={t=>setTemplate(t)} />}
      {modalCrm && <CrmModal crm={modalCrm} onClose={()=>setModalCrm(null)} onSave={(id,st,nt)=>{
        setCrmLeads(crmLeads.map(l => l.id===id ? {...l, stage:st, notes:nt} : l));
        setModalCrm(null);
      }} />}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("prospectai_session") ? "app" : "landing";
    } catch { return "landing"; }
  });
  
  if (view === "app") return <MainApp onLogout={()=>{localStorage.removeItem("prospectai_session"); setView("landing");}} />;
  if (view === "login") return <LoginPage onSuccess={()=>setView("app")} onBack={()=>setView("landing")} />;
  return <LandingPage onLogin={()=>setView("login")} />;
}
