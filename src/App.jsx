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
const fmtPhone = (p = "") => {
  const d = String(p).replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p || null;
};

const igHandle = (url = "") => {
  if (!url) return null;
  try {
    const h = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "";
    return h ? `@${h}` : null;
  } catch { return null; }
};

const waLink = (p = "") => {
  const d = String(p).replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/55${d}` : null;
};

const buildMsg = (tpl, nome) => tpl.replace(/\{nome\}/g, nome);

// Função robusta para obter a API Key
const getApiKey = () => {
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
   if (apiKey) return apiKey;
  
  try {
    // Tenta variáveis de ambiente do Vite/Vercel
    if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
    const meta = (import.meta);
    if (meta?.env?.VITE_GEMINI_API_KEY) return meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {}
  
  return ""; 
};

async function fetchWithRetry(url, options, maxRetries = 5) {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403 || res.status === 401) {
            throw new Error("Erro de API Key: Verifique se a chave está configurada no Vercel.");
        }
        throw new Error(errorData.error?.message || `Erro HTTP ${res.status}`);
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
  if (!apiKey) throw new Error("API Key não encontrada. Configure VITE_GEMINI_API_KEY.");

  const prompt = `Encontre contatos reais de estabelecimentos do tipo "${ramo}" em "${cidade}", Brasil. 
Extraia obrigatoriamente: nome, whatsapp (com DDD) e URL do Instagram.
Retorne exatamente 10 resultados no formato JSON abaixo:
{ "resultados": [{ "nome": "...", "whatsapp": "...", "instagram": "..." }] }`;

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
  try {
    return JSON.parse(text).resultados || [];
  } catch (err) {
    throw new Error("Falha ao processar dados da IA.");
  }
}

/* ═══════════════════════════════════════════════════════
   COMPONENTES DE INTERFACE
══════════════════════════════════════════════════════════ */

function CopyBtn({ value, label }) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    const clean = String(value).replace(/\D/g, "");
    navigator.clipboard.writeText(clean);
    setOk(true); setTimeout(() => setOk(false), 2000);
  };
  return (
    <button onClick={copy} style={{ 
      background: ok ? "rgba(34,211,165,0.1)" : "#0a1628",
      color: ok ? "#22d3a5" : "#64748b",
      border: `1px solid ${ok ? "#22d3a5" : "#1e3248"}`,
      padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11
    }}>
      {ok ? "Copiado!" : label || "Copiar"}
    </button>
  );
}

function MsgModal({ lead, template, onClose }) {
  const [copied, setCopied] = useState(false);
  const msg = buildMsg(template, lead.nome);
  const wa = lead.whatsapp ? waLink(lead.whatsapp) : null;
  
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e", border:"1px solid #1e3248", borderRadius:24, padding:32, width:480, maxWidth:"100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:20, color:"#fff" }}>Enviar Mensagem</div>
        <div style={{ background:"#07111d", borderRadius:16, padding:20, fontSize:15, color:"#e2eaf5", lineHeight:1.6, marginBottom:24, border:"1px solid #1e3248", whiteSpace:"pre-wrap" }}>{msg}</div>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={()=>{navigator.clipboard.writeText(msg); setCopied(true);}} style={{ flex:1, padding:14, borderRadius:12, border:"1px solid #1e3248", background:"transparent", color:copied?"#22d3a5":"#fff", cursor:"pointer", fontWeight:700 }}>
            {copied ? "✓ Copiado" : "Copiar Texto"}
          </button>
          {wa && (
            <a href={`${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" style={{ flex:1, padding:14, borderRadius:12, background:"#25d366", color:"#000", textAlign:"center", textDecoration:"none", fontWeight:800 }}>
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateModal({ template, onClose, onSave }) {
  const [val, setVal] = useState(template);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e", padding:32, borderRadius:24, width:500, border:"1px solid #1e3248" }}>
        <h3 style={{ marginTop:0, color:"#fff" }}>Editar Template</h3>
        <textarea value={val} onChange={e=>setVal(e.target.value)} rows={8} style={{ width:"100%", background:"#07111d", color:"#fff", padding:16, borderRadius:12, border:"1px solid #1e3248", fontSize:14, marginBottom:10 }} />
        <p style={{ fontSize:12, color:"#64748b", marginBottom:24 }}>Use <b>{"{nome}"}</b> para inserir o nome do lead automaticamente.</p>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:12 }}>
          <button onClick={onClose} style={{ background:"transparent", color:"#64748b", border:"none", cursor:"pointer" }}>Cancelar</button>
          <button onClick={()=>{onSave(val); onClose();}} style={{ background:"#22d3a5", color:"#000", padding:"12px 24px", borderRadius:12, border:"none", fontWeight:800, cursor:"pointer" }}>Salvar Template</button>
        </div>
      </div>
    </div>
  );
}

function CrmModal({ crm, onClose, onSave }) {
  const [stage, setStage] = useState(crm?.stage || "novo");
  const [notes, setNotes] = useState(crm?.notes || "");
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e", padding:32, borderRadius:24, width:400, border:"1px solid #1e3248" }}>
        <h3 style={{ marginTop:0, color:"#fff" }}>{crm.nome}</h3>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b", marginBottom:8, textTransform:"uppercase" }}>Estágio do Funil</label>
          <select value={stage} onChange={e=>setStage(e.target.value)} style={{ width:"100%", padding:14, background:"#07111d", color:"#fff", borderRadius:12, border:"1px solid #1e3248" }}>
            {Object.entries(STAGES).map(([k,s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b", marginBottom:8, textTransform:"uppercase" }}>Anotações</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} style={{ width:"100%", background:"#07111d", color:"#fff", padding:14, borderRadius:12, border:"1px solid #1e3248" }} placeholder="Detalhes da negociação..." />
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={onClose} style={{ flex:1, background:"transparent", color:"#64748b", border:"none", cursor:"pointer" }}>Fechar</button>
          <button onClick={()=>onSave(crm.id, stage, notes)} style={{ flex:2, background:"#22d3a5", color:"#000", padding:14, borderRadius:12, border:"none", fontWeight:800, cursor:"pointer" }}>Atualizar Lead</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PÁGINAS PRINCIPAIS
══════════════════════════════════════════════════════════ */

function LandingPage({ onLogin }) {
  return (
    <div style={{ background:"#060f1a", color:"#e2eaf5", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:40 }}>
      <div style={{ width:80, height:80, background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", borderRadius:24, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, marginBottom:32, boxShadow:"0 20px 40px rgba(34,211,165,0.2)" }}>🎯</div>
      <h1 style={{ fontSize:56, fontWeight:900, marginBottom:20, letterSpacing:"-0.02em" }}>ProspectAI <span style={{ color:"#22d3a5" }}>Gemini</span></h1>
      <p style={{ fontSize:20, color:"#94a3b8", maxWidth:600, lineHeight:1.6, marginBottom:40 }}>Encontre leads qualificados com WhatsApp e Instagram em segundos usando o poder da Inteligência Artificial do Google.</p>
      <button onClick={onLogin} style={{ padding:"20px 56px", borderRadius:16, border:"none", background:"#22d3a5", color:"#000", fontSize:20, fontWeight:800, cursor:"pointer", boxShadow:"0 10px 20px rgba(34,211,165,0.3)" }}>Começar Prospecção</button>
    </div>
  );
}

function LoginPage({ onSuccess, onBack }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const handle = () => {
    if (email.trim().toLowerCase() === DEMO_USER.email && pass === DEMO_USER.pass) {
      localStorage.setItem("prospectai_session", "true");
      onSuccess();
    } else { alert("Acesso negado. Use as credenciais demo."); }
  };
  return (
    <div style={{ background:"#060f1a", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#0f1c2e", padding:48, borderRadius:32, width:400, border:"1px solid #1e3248" }}>
        <h2 style={{ fontSize:28, fontWeight:800, marginBottom:32 }}>Bem-vindo</h2>
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:"100%", padding:16, marginBottom:16, borderRadius:12, background:"#07111d", color:"#fff", border:"1px solid #1e3248" }} />
        <input type="password" placeholder="Senha" value={pass} onChange={e=>setPass(e.target.value)} style={{ width:"100%", padding:16, marginBottom:32, borderRadius:12, background:"#07111d", color:"#fff", border:"1px solid #1e3248" }} />
        <button onClick={handle} style={{ width:"100%", padding:18, background:"#22d3a5", border:"none", borderRadius:12, fontWeight:800, fontSize:16, cursor:"pointer" }}>Entrar no Painel</button>
        <button onClick={onBack} style={{ width:"100%", background:"transparent", border:"none", color:"#64748b", marginTop:20, cursor:"pointer" }}>Voltar</button>
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
    try { return JSON.parse(localStorage.getItem("prospectai_crm") || "[]"); } catch { return []; }
  });

  useEffect(() => { 
    localStorage.setItem("prospectai_crm", JSON.stringify(crmLeads)); 
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
    setTab("crm");
  };

  const removeLead = (id) => {
    if (confirm("Remover este lead permanentemente?")) {
      setCrmLeads(crmLeads.filter(l => l.id !== id));
    }
  };

  return (
    <div style={{ background:"#060f1a", minHeight:"100vh", color:"#e2eaf5" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 20px" }}>
        
        {/* Header Fiel ao Original */}
        <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:40, background:"#0f1c2e", padding:"16px 24px", borderRadius:20, border:"1px solid #1e3248" }}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:36, height:36, background:"#22d3a5", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", color:"#000", fontWeight:900 }}>P</div>
            <span style={{ fontWeight:800, fontSize:20 }}>ProspectAI</span>
          </div>
          <div style={{ display:"flex", gap:8, background:"#07111d", padding:6, borderRadius:14 }}>
            <button onClick={()=>setTab("prospector")} style={{ background:tab==="prospector"?"#22d3a5":"transparent", color:tab==="prospector"?"#000":"#64748b", padding:"10px 20px", borderRadius:10, border:"none", fontWeight:800, cursor:"pointer" }}>🔍 Prospector</button>
            <button onClick={()=>setTab("crm")} style={{ background:tab==="crm"?"#22d3a5":"transparent", color:tab==="crm"?"#000":"#64748b", padding:"10px 20px", borderRadius:10, border:"none", fontWeight:800, cursor:"pointer" }}>📊 CRM ({crmLeads.length})</button>
          </div>
          <button onClick={onLogout} style={{ color:"#fb7185", background:"transparent", border:"none", fontWeight:700, cursor:"pointer" }}>Sair</button>
        </header>

        {tab === "prospector" ? (
          <div style={{ maxWidth:800, margin:"0 auto" }}>
            <div style={{ textAlign:"center", marginBottom:40 }}>
              <h2 style={{ fontSize:32, fontWeight:900, marginBottom:12 }}>Onde vamos buscar hoje?</h2>
              <p style={{ color:"#64748b" }}>Defina o nicho e a localização para a IA encontrar seus próximos clientes.</p>
            </div>

            <div style={{ background:"#0f1c2e", padding:32, borderRadius:24, border:"1px solid #1e3248", marginBottom:40, display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:16, alignItems:"end" }}>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:800, color:"#64748b", marginBottom:10, textTransform:"uppercase" }}>Segmento</label>
                <input placeholder="Ex: Escritórios de Advocacia" value={ramo} onChange={e=>setRamo(e.target.value)} style={{ width:"100%", padding:16, borderRadius:12, background:"#07111d", color:"#fff", border:"1px solid #1e3248" }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:800, color:"#64748b", marginBottom:10, textTransform:"uppercase" }}>Cidade</label>
                <input placeholder="Ex: Curitiba, PR" value={cidade} onChange={e=>setCidade(e.target.value)} style={{ width:"100%", padding:16, borderRadius:12, background:"#07111d", color:"#fff", border:"1px solid #1e3248" }} />
              </div>
              <button onClick={buscar} disabled={loading} style={{ background:"#22d3a5", color:"#000", padding:"18px 32px", borderRadius:12, fontWeight:900, fontSize:15, cursor:"pointer", opacity: loading?0.7:1 }}>
                {loading ? "Buscando..." : "Explorar"}
              </button>
            </div>

            {erro && <div style={{ background:"rgba(251,113,133,0.1)", border:"1px solid #fb7185", color:"#fb7185", padding:16, borderRadius:12, marginBottom:24, textAlign:"center" }}>{erro}</div>}

            <div style={{ display:"grid", gap:16 }}>
              {resultados.map((r, i) => (
                <div key={i} style={{ background:"#0f1c2e", padding:24, borderRadius:20, border:"1px solid #1e3248", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:18, marginBottom:6 }}>{r.nome}</div>
                    <div style={{ display:"flex", gap:16, fontSize:13, color:"#64748b" }}>
                      <span>📱 {fmtPhone(r.whatsapp) || "Não informado"}</span>
                      <span>📸 {igHandle(r.instagram) || "Não informado"}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:12 }}>
                    <button onClick={()=>setMsgLead(r)} style={{ background:"transparent", border:"1px solid #1e3248", color:"#fff", padding:"10px 20px", borderRadius:10, fontWeight:700, cursor:"pointer" }}>Mensagem</button>
                    <button onClick={()=>addToCRM(r)} style={{ background:"#22d3a5", color:"#000", padding:"10px 20px", borderRadius:10, fontWeight:800, cursor:"pointer" }}>Salvar no CRM</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
              <h2 style={{ fontSize:28, fontWeight:900 }}>Funil de Vendas</h2>
              <button onClick={()=>setShowTpl(true)} style={{ background:"#07111d", border:"1px solid #1e3248", color:"#64748b", padding:"10px 20px", borderRadius:12, fontWeight:700, cursor:"pointer" }}>⚙️ Configurar Mensagem</button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(250px, 1fr))", gap:20, alignItems:"start" }}>
              {Object.keys(STAGES).map(s => (
                <div key={s} style={{ background:"rgba(15,28,46,0.4)", borderRadius:24, padding:16, minHeight:500, border:"1px solid rgba(30,50,72,0.5)" }}>
                  <div style={{ color:STAGES[s].color, fontWeight:900, fontSize:12, marginBottom:20, display:"flex", alignItems:"center", gap:8, textTransform:"uppercase", letterSpacing:1 }}>
                    <span style={{ width:8, height:8, background:STAGES[s].color, borderRadius:10 }}></span>
                    {STAGES[s].label}
                  </div>
                  {crmLeads.filter(l => l.stage === s).map(l => (
                    <div key={l.id} style={{ background:"#0f1c2e", padding:20, borderRadius:18, marginBottom:12, border:"1px solid #1e3248", position:"relative" }}>
                      <div style={{ fontWeight:800, fontSize:15, marginBottom:4, cursor:"pointer" }} onClick={()=>setModalCrm(l)}>{l.nome}</div>
                      <div style={{ fontSize:12, color:"#64748b", marginBottom:16 }}>{fmtPhone(l.whatsapp)}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={()=>setMsgLead(l)} style={{ flex:1, background:"#07111d", border:"1px solid #1e3248", color:"#e2eaf5", padding:8, borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer" }}>Enviar</button>
                        <button onClick={()=>removeLead(l.id)} style={{ width:34, background:"transparent", border:"none", color:"#fb7185", cursor:"pointer", opacity:0.5 }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
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
    try { return localStorage.getItem("prospectai_session") ? "app" : "landing"; } catch { return "landing"; }
  });
  
  if (view === "app") return <MainApp onLogout={()=>{localStorage.removeItem("prospectai_session"); setView("landing");}} />;
  if (view === "login") return <LoginPage onSuccess={()=>setView("app")} onBack={()=>setView("landing")} />;
  return <LandingPage onLogin={()=>setView("login")} />;
}
