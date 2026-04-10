import { useState, useCallback, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════
   CONSTANTES GLOBAIS
══════════════════════════════════════════════════════════ */
const HEADERS = {
  "Content-Type": "application/json",
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
};

const DEFAULT_TPL = `Olá, {nome}! 👋\n\nVi o perfil de vocês e gostaria de apresentar uma oportunidade que pode ajudar no crescimento do negócio.\n\nPosso te enviar mais detalhes?`;

const STAGES = {
  novo:        { label: "🟢 Novo",        color: "#22d3a5", bg: "rgba(34,211,165,0.08)" },
  contatado:   { label: "🔵 Contatado",   color: "#38bdf8", bg: "rgba(56,189,248,0.08)" },
  interessado: { label: "🟡 Interessado", color: "#fbbf24", bg: "rgba(251,191,36,0.08)"  },
  negociando:  { label: "🟠 Negociando",  color: "#fb923c", bg: "rgba(251,146,60,0.08)"  },
  convertido:  { label: "🟣 Convertido",  color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  descartado:  { label: "⚫ Descartado",  color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

/* usuário demo — em produção real, substitua por backend/Supabase */
const DEMO_USER = { email: "demo@prospectai.com.br", pass: "prospect123" };

/* ═══════════════════════════════════════════════════════
   HELPERS
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

async function buscarLeads(ramo, cidade, excluir = []) {
  const excStr = excluir.length
    ? `\nNão retorne: ${excluir.slice(0,40).join(", ")}.` : "";
  const prompt = `Faça uma busca no Google por estabelecimentos de "${ramo}" em "${cidade}", Brasil.${excStr}
Extraia: nome, WhatsApp/telefone (formato BR), URL do Instagram.
Retorne SOMENTE JSON puro:
{"resultados":[{"nome":"Nome","whatsapp":"(11) 99999-9999","instagram":"https://instagram.com/perfil"}]}
Regras: busque Google Maps, Instagram, sites. Até 10 resultados. whatsapp/instagram null se não encontrar.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Nenhum resultado encontrado");
  return JSON.parse(match[0]).resultados || [];
}

/* ═══════════════════════════════════════════════════════
   COMPONENTES PEQUENOS
══════════════════════════════════════════════════════════ */
function CopyBtn({ value }) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    const clean = String(value).replace(/\D/g, "");
    const fb = () => { const t=document.createElement("textarea"); t.value=clean; t.style.cssText="position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); };
    navigator.clipboard ? navigator.clipboard.writeText(clean).catch(fb) : fb();
    setOk(true); setTimeout(()=>setOk(false),2000);
  };
  return (
    <button onClick={copy} style={{ display:"inline-flex",alignItems:"center",padding:"4px 9px",borderRadius:6,border:`1px solid ${ok?"#22d3a5":"#2a3a52"}`,background:ok?"rgba(34,211,165,0.1)":"transparent",color:ok?"#22d3a5":"#64748b",fontSize:12,cursor:"pointer",transition:"all 0.2s",fontFamily:"monospace" }}>
      {ok?"✓":"📋"}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   MODAIS
══════════════════════════════════════════════════════════ */
function MsgModal({ lead, template, onClose }) {
  const [copied, setCopied] = useState(false);
  const msg = buildMsg(template, lead.nome);
  const wa = lead.whatsapp ? waLink(lead.whatsapp) : null;
  const waMsg = wa ? `${wa}?text=${encodeURIComponent(msg)}` : null;
  const copy = () => {
    const fb=()=>{ const t=document.createElement("textarea"); t.value=msg; t.style.cssText="position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); };
    navigator.clipboard ? navigator.clipboard.writeText(msg).catch(fb) : fb();
    setCopied(true); setTimeout(()=>setCopied(false),2500);
  };
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e",border:"1px solid #1e3248",borderRadius:18,padding:28,width:480,maxWidth:"100%" }}>
        <div style={{ fontSize:11,fontFamily:"monospace",color:"#64748b",letterSpacing:2,marginBottom:6 }}>MENSAGEM PARA</div>
        <div style={{ fontSize:18,fontWeight:800,marginBottom:20,color:"#e2eaf5" }}>{lead.nome}</div>
        <div style={{ background:"#005c4b",borderRadius:"4px 14px 14px 14px",padding:"14px 16px",fontSize:14,color:"#e9ffef",lineHeight:1.75,whiteSpace:"pre-wrap",marginBottom:16 }}>
          {msg}
          <div style={{ textAlign:"right",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:8 }}>
            {new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} ✓✓
          </div>
        </div>
        <div style={{ display:"flex",gap:10,marginBottom:10 }}>
          <button onClick={copy} style={{ flex:1,padding:"11px",borderRadius:10,border:`1px solid ${copied?"#22d3a5":"#1e3248"}`,background:copied?"rgba(34,211,165,0.1)":"transparent",color:copied?"#22d3a5":"#64748b",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.2s" }}>
            {copied?"✓ Copiado!":"📋 Copiar mensagem"}
          </button>
          {waMsg && (
            <a href={waMsg} target="_blank" rel="noreferrer" style={{ flex:1,padding:"11px",borderRadius:10,border:"1px solid #25d366",background:"rgba(37,211,102,0.08)",color:"#25d366",fontSize:13,fontWeight:700,textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
              💬 Abrir no WhatsApp
            </a>
          )}
        </div>
        <button onClick={onClose} style={{ width:"100%",padding:"9px",borderRadius:8,border:"1px solid #1e3248",background:"transparent",color:"#3d5a75",cursor:"pointer",fontSize:12 }}>Fechar</button>
      </div>
    </div>
  );
}

function TemplateModal({ template, onClose, onSave }) {
  const [val, setVal] = useState(template);
  const ref = useRef(null);
  const insert = (tag) => {
    const ta=ref.current;
    if (!ta){ setVal(v=>v+tag); return; }
    const s=ta.selectionStart, e=ta.selectionEnd;
    setVal(val.slice(0,s)+tag+val.slice(e));
    setTimeout(()=>{ ta.selectionStart=ta.selectionEnd=s+tag.length; ta.focus(); },0);
  };
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e",border:"1px solid #1e3248",borderRadius:18,padding:28,width:520,maxWidth:"100%" }}>
        <div style={{ fontSize:17,fontWeight:800,marginBottom:6,color:"#e2eaf5" }}>✏️ Template da mensagem</div>
        <div style={{ fontSize:12,color:"#64748b",marginBottom:14 }}>Variável disponível:</div>
        <button onClick={()=>insert("{nome}")} style={{ padding:"5px 14px",borderRadius:6,border:"1px solid #22d3a5",background:"rgba(34,211,165,0.08)",color:"#22d3a5",fontSize:12,cursor:"pointer",fontFamily:"monospace",fontWeight:700,marginBottom:12 }}>+ {"{nome}"}</button>
        <textarea ref={ref} value={val} onChange={e=>setVal(e.target.value)} rows={8}
          style={{ width:"100%",padding:"12px",background:"#0a1628",border:"1px solid #1e3248",borderRadius:8,color:"#e2eaf5",fontSize:14,resize:"vertical",outline:"none",fontFamily:"inherit",lineHeight:1.65 }} />
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:16 }}>
          <button onClick={onClose} style={{ padding:"9px 20px",borderRadius:8,border:"1px solid #1e3248",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600 }}>Cancelar</button>
          <button onClick={()=>{ onSave(val); onClose(); }} style={{ padding:"9px 24px",borderRadius:8,border:"none",background:"#22d3a5",color:"#000",cursor:"pointer",fontSize:13,fontWeight:700 }}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
}

function CrmModal({ crm, onClose, onSave }) {
  const [stage, setStage] = useState(crm?.stage||"novo");
  const [notes, setNotes] = useState(crm?.notes||"");
  if (!crm) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f1c2e",border:"1px solid #1e3248",borderRadius:18,padding:28,width:420,maxWidth:"100%" }}>
        <div style={{ fontSize:18,fontWeight:800,marginBottom:20,color:"#e2eaf5" }}>{crm.nome}</div>
        {crm.whatsapp && <div style={{ marginBottom:14 }}><div style={{ fontSize:11,color:"#64748b",marginBottom:5,letterSpacing:1 }}>TELEFONE</div><div style={{ fontSize:13,padding:"8px 12px",background:"#0a1628",borderRadius:8,border:"1px solid #1e3248",color:"#e2eaf5",fontFamily:"monospace" }}>{fmtPhone(crm.whatsapp)}</div></div>}
        {crm.instagram && <div style={{ marginBottom:14 }}><div style={{ fontSize:11,color:"#64748b",marginBottom:5,letterSpacing:1 }}>INSTAGRAM</div><a href={crm.instagram} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,border:"1px solid #e1306c50",background:"rgba(225,48,108,0.08)",color:"#e1306c",fontSize:13,fontWeight:700,textDecoration:"none" }}>📸 {igHandle(crm.instagram)||"Ver perfil"}</a></div>}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,color:"#64748b",marginBottom:5,letterSpacing:1 }}>ESTÁGIO</div>
          <select value={stage} onChange={e=>setStage(e.target.value)} style={{ width:"100%",padding:"8px 12px",background:"#0a1628",border:"1px solid #1e3248",borderRadius:8,color:"#e2eaf5",fontSize:13,outline:"none" }}>
            {Object.entries(STAGES).map(([k,s])=><option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,color:"#64748b",marginBottom:5,letterSpacing:1 }}>ANOTAÇÕES</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observações..." style={{ width:"100%",padding:"8px 12px",background:"#0a1628",border:"1px solid #1e3248",borderRadius:8,color:"#e2eaf5",fontSize:13,resize:"vertical",minHeight:80,outline:"none",fontFamily:"inherit" }} />
        </div>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"9px 20px",borderRadius:8,border:"1px solid #1e3248",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600 }}>Cancelar</button>
          <button onClick={()=>onSave(crm.id,stage,notes)} style={{ padding:"9px 24px",borderRadius:8,border:"none",background:"#22d3a5",color:"#000",cursor:"pointer",fontSize:13,fontWeight:700 }}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════ */
function LandingPage({ onLogin }) {
  const features = [
    { icon:"🔍", title:"Busca Inteligente", desc:"Pesquisa no Google em tempo real e extrai nome, WhatsApp e Instagram de qualquer nicho e cidade do Brasil." },
    { icon:"📸", title:"Instagram Direto", desc:"Link clicável para o perfil de cada lead encontrado. Acesse o Instagram do prospect com um toque." },
    { icon:"💬", title:"Mensagem Personalizada", desc:"Gere uma mensagem com o nome do lead pronta para copiar e colar no WhatsApp. Zero tempo perdido." },
    { icon:"📊", title:"CRM Integrado", desc:"Pipeline kanban com 6 etapas: Novo, Contatado, Interessado, Negociando, Convertido e Descartado." },
    { icon:"💾", title:"Dados Salvos", desc:"Seus leads e estágios do CRM ficam salvos automaticamente. Nunca perca um contato importante." },
    { icon:"🔄", title:"Carga Ilimitada", desc:"Carregue mais 10 contatos com um clique. Prospecte dezenas de leads por sessão sem repetir resultados." },
  ];

  const testimonials = [
    { name:"Rodrigo Alves", role:"Agência de Marketing Digital", text:"Em 3 dias de uso já fechei 2 clientes novos. A busca por Instagram é um diferencial absurdo.", stars:5 },
    { name:"Camila Torres", role:"Consultora de Vendas", text:"Economizo 2 horas por dia que eu gastava pesquisando manualmente no Google. Produto sensacional.", stars:5 },
    { name:"Felipe Martins", role:"Freelancer de Tráfego Pago", text:"O CRM integrado resolve tudo. Não preciso mais de planilha pra acompanhar meus prospects.", stars:5 },
  ];

  return (
    <div style={{ background:"#060f1a", color:"#e2eaf5", fontFamily:"'Segoe UI', system-ui, sans-serif", minHeight:"100vh" }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes glow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .land-card:hover { transform:translateY(-4px); border-color:#22d3a550 !important; }
        .land-card { transition: all 0.25s; }
        .cta-btn:hover { transform:translateY(-2px); box-shadow:0 12px 40px rgba(34,211,165,0.35) !important; }
        .cta-btn { transition: all 0.2s; }
        .test-card:hover { border-color:#22d3a540 !important; }
        .test-card { transition: border-color 0.2s; }
      `}</style>

      {/* NAV */}
      <nav style={{ padding:"18px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #0f2236", position:"sticky", top:0, background:"rgba(6,15,26,0.95)", backdropFilter:"blur(12px)", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🎯</div>
          <span style={{ fontWeight:800, fontSize:18, letterSpacing:"-0.5px" }}>ProspectAI</span>
        </div>
        <button onClick={onLogin} style={{ padding:"9px 22px", borderRadius:9, border:"1px solid #22d3a5", background:"transparent", color:"#22d3a5", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          Acessar →
        </button>
      </nav>

      {/* HERO */}
      <section style={{ textAlign:"center", padding:"80px 24px 60px", maxWidth:780, margin:"0 auto" }}>
        <div style={{ display:"inline-block", padding:"5px 16px", borderRadius:20, border:"1px solid #22d3a540", background:"rgba(34,211,165,0.06)", fontSize:12, color:"#22d3a5", fontWeight:700, letterSpacing:2, marginBottom:28, textTransform:"uppercase" }}>
          Prospecção inteligente com IA
        </div>
        <h1 style={{ fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:900, lineHeight:1.1, marginBottom:20, letterSpacing:"-1px" }}>
          Encontre clientes com<br />
          <span style={{ background:"linear-gradient(90deg,#22d3a5,#0ea5e9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            WhatsApp e Instagram
          </span><br />
          em segundos
        </h1>
        <p style={{ fontSize:18, color:"#94a3b8", lineHeight:1.7, marginBottom:36, maxWidth:560, margin:"0 auto 36px" }}>
          Digite o ramo e a cidade. Nossa IA busca no Google, extrai contatos reais e organiza tudo em um CRM pronto para converter.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button className="cta-btn" onClick={onLogin} style={{ padding:"16px 40px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", color:"#000", fontSize:16, fontWeight:800, cursor:"pointer", boxShadow:"0 8px 30px rgba(34,211,165,0.25)" }}>
            🚀 Começar agora — R$ 197
          </button>
          <button className="cta-btn" onClick={onLogin} style={{ padding:"16px 32px", borderRadius:12, border:"1px solid #1e3248", background:"transparent", color:"#94a3b8", fontSize:16, fontWeight:600, cursor:"pointer" }}>
            Ver demonstração →
          </button>
        </div>
        <div style={{ marginTop:20, fontSize:13, color:"#475569" }}>✓ Acesso vitalício &nbsp;·&nbsp; ✓ Sem mensalidade &nbsp;·&nbsp; ✓ Ativação imediata</div>
      </section>

      {/* MOCKUP */}
      <section style={{ maxWidth:860, margin:"0 auto 80px", padding:"0 24px" }}>
        <div style={{ background:"linear-gradient(135deg,#0f1c2e,#0a1628)", border:"1px solid #1e3248", borderRadius:20, padding:"28px 24px", boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ display:"flex", gap:6, marginBottom:20 }}>
            {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{ width:12,height:12,borderRadius:"50%",background:c }} />)}
          </div>
          {[
            { nome:"Studio Fit Academia", wa:"(31) 99823-4510", ig:"@studiofit_bh" },
            { nome:"Personal Trainer Renato", wa:"(31) 98745-2233", ig:"@renato.personal" },
            { nome:"CrossFit Horizonte", wa:"(31) 97612-8841", ig:"@crossfithorizonte" },
          ].map((r, i) => (
            <div key={i} style={{ background:"#0a1628", border:"1px solid #1e3248", borderRadius:10, padding:"12px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", opacity: 1 - i * 0.15 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", background:"#1e3248", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#475569", fontFamily:"monospace" }}>{i+1}</div>
              <div style={{ flex:1, fontWeight:700, fontSize:14 }}>{r.nome}</div>
              <span style={{ fontFamily:"monospace", fontSize:12, color:"#22d3a5" }}>{r.wa}</span>
              <span style={{ padding:"4px 11px", borderRadius:20, border:"1px solid #e1306c50", background:"rgba(225,48,108,0.08)", color:"#e1306c", fontSize:11, fontWeight:700 }}>📸 {r.ig}</span>
              <span style={{ padding:"4px 11px", borderRadius:6, border:"1px solid #25d36650", background:"rgba(37,211,102,0.08)", color:"#25d366", fontSize:11, fontWeight:700 }}>💬 WA</span>
            </div>
          ))}
          <div style={{ textAlign:"center", marginTop:12, color:"#475569", fontSize:12 }}>↓ carregando mais resultados...</div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth:960, margin:"0 auto 80px", padding:"0 24px" }}>
        <h2 style={{ textAlign:"center", fontSize:"clamp(1.5rem,3vw,2.2rem)", fontWeight:800, marginBottom:48, letterSpacing:"-0.5px" }}>
          Tudo que você precisa para prospectar
        </h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16 }}>
          {features.map((f, i) => (
            <div key={i} className="land-card" style={{ background:"#0f1c2e", border:"1px solid #1e3248", borderRadius:14, padding:"24px 22px" }}>
              <div style={{ fontSize:28, marginBottom:14 }}>{f.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>{f.title}</div>
              <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section style={{ maxWidth:860, margin:"0 auto 80px", padding:"0 24px" }}>
        <h2 style={{ textAlign:"center", fontSize:"clamp(1.5rem,3vw,2.2rem)", fontWeight:800, marginBottom:48, letterSpacing:"-0.5px" }}>
          Quem já usa, aprova
        </h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16 }}>
          {testimonials.map((t, i) => (
            <div key={i} className="test-card" style={{ background:"#0f1c2e", border:"1px solid #1e3248", borderRadius:14, padding:"22px" }}>
              <div style={{ color:"#fbbf24", fontSize:14, marginBottom:12 }}>{"★".repeat(t.stars)}</div>
              <p style={{ fontSize:14, color:"#94a3b8", lineHeight:1.65, marginBottom:16, fontStyle:"italic" }}>"{t.text}"</p>
              <div style={{ fontWeight:700, fontSize:13 }}>{t.name}</div>
              <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>{t.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ maxWidth:500, margin:"0 auto 80px", padding:"0 24px" }} id="preco">
        <h2 style={{ textAlign:"center", fontSize:"clamp(1.5rem,3vw,2.2rem)", fontWeight:800, marginBottom:8, letterSpacing:"-0.5px" }}>
          Investimento único
        </h2>
        <p style={{ textAlign:"center", color:"#64748b", marginBottom:36, fontSize:15 }}>Pague uma vez, use para sempre.</p>
        <div style={{ background:"linear-gradient(135deg,#0f1c2e,#0a1e35)", border:"2px solid #22d3a5", borderRadius:20, padding:"36px 32px", textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:16, right:16, background:"#22d3a5", color:"#000", fontSize:11, fontWeight:800, padding:"4px 12px", borderRadius:20, letterSpacing:1 }}>MAIS POPULAR</div>
          <div style={{ fontSize:13, color:"#22d3a5", fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:12 }}>Acesso Vitalício</div>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", gap:4, marginBottom:6 }}>
            <span style={{ fontSize:18, color:"#64748b", marginTop:10, fontWeight:600 }}>R$</span>
            <span style={{ fontSize:68, fontWeight:900, lineHeight:1, letterSpacing:"-3px", color:"#e2eaf5" }}>197</span>
          </div>
          <div style={{ color:"#475569", fontSize:13, marginBottom:28, textDecoration:"line-through" }}>De R$ 497 · Oferta por tempo limitado</div>
          <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px", textAlign:"left" }}>
            {[
              "✓ Busca ilimitada por nicho e cidade",
              "✓ WhatsApp + Instagram de cada lead",
              "✓ Mensagem personalizada por contato",
              "✓ CRM kanban com 6 estágios",
              "✓ Dados salvos automaticamente",
              "✓ Atualizações inclusas",
              "✓ Sem mensalidade, nunca",
            ].map((item, i) => (
              <li key={i} style={{ fontSize:14, color:"#94a3b8", padding:"5px 0", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"#22d3a5" }}>{item.slice(0,1)}</span>
                <span>{item.slice(2)}</span>
              </li>
            ))}
          </ul>
          <button className="cta-btn" onClick={onLogin} style={{ width:"100%", padding:"16px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", color:"#000", fontSize:16, fontWeight:800, cursor:"pointer", boxShadow:"0 8px 30px rgba(34,211,165,0.25)" }}>
            Quero meu acesso agora →
          </button>
          <div style={{ marginTop:14, fontSize:12, color:"#475569" }}>🔒 Pagamento seguro · Acesso imediato após confirmação</div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth:620, margin:"0 auto 80px", padding:"0 24px" }}>
        <h2 style={{ textAlign:"center", fontSize:"1.6rem", fontWeight:800, marginBottom:32, letterSpacing:"-0.5px" }}>Perguntas frequentes</h2>
        {[
          ["Os dados são reais?", "Sim. A busca usa IA com acesso ao Google em tempo real. Os contatos e perfis encontrados são de estabelecimentos reais."],
          ["Precisa pagar mensalidade?", "Não. O pagamento é único e o acesso é vitalício. Sem surpresas na fatura."],
          ["Funciona para qualquer nicho?", "Sim. Academia, clínica, salão, restaurante, imobiliária, escritório — qualquer segmento e qualquer cidade do Brasil."],
          ["Como acesso após a compra?", "Você recebe login e senha por e-mail imediatamente após a confirmação do pagamento."],
        ].map(([q, a], i) => (
          <div key={i} style={{ borderBottom:"1px solid #1e3248", padding:"18px 0" }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>{q}</div>
            <div style={{ fontSize:14, color:"#64748b", lineHeight:1.6 }}>{a}</div>
          </div>
        ))}
      </section>

      {/* FOOTER CTA */}
      <section style={{ textAlign:"center", padding:"60px 24px 80px", borderTop:"1px solid #0f2236" }}>
        <h2 style={{ fontSize:"clamp(1.5rem,3vw,2rem)", fontWeight:800, marginBottom:16, letterSpacing:"-0.5px" }}>
          Pronto para prospectar do jeito certo?
        </h2>
        <p style={{ color:"#64748b", marginBottom:28, fontSize:15 }}>Acesso vitalício por R$ 197. Sem mensalidade.</p>
        <button className="cta-btn" onClick={onLogin} style={{ padding:"16px 48px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", color:"#000", fontSize:16, fontWeight:800, cursor:"pointer", boxShadow:"0 8px 30px rgba(34,211,165,0.25)" }}>
          🚀 Começar agora
        </button>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TELA DE LOGIN
══════════════════════════════════════════════════════════ */
function LoginPage({ onSuccess, onBack }) {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = () => {
    if (!email || !pass) { setErr("Preencha email e senha."); return; }
    setLoading(true); setErr("");
    setTimeout(() => {
      if (email.trim().toLowerCase() === DEMO_USER.email && pass === DEMO_USER.pass) {
        localStorage.setItem("prospectai_session", JSON.stringify({ email, ts: Date.now() }));
        onSuccess();
      } else {
        setErr("E-mail ou senha incorretos. Use: demo@prospectai.com.br / prospect123");
      }
      setLoading(false);
    }, 700);
  };

  return (
    <div style={{ background:"#060f1a", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI', system-ui, sans-serif", padding:24 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <button onClick={onBack} style={{ position:"absolute", top:24, left:24, background:"transparent", border:"none", color:"#64748b", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
        ← Voltar
      </button>

      <div style={{ width:42, height:42, background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:20 }}>🎯</div>
      <h1 style={{ fontSize:24, fontWeight:800, color:"#e2eaf5", marginBottom:6, letterSpacing:"-0.5px" }}>Entrar no ProspectAI</h1>
      <p style={{ color:"#64748b", fontSize:14, marginBottom:32 }}>Bem-vindo de volta</p>

      <div style={{ background:"#0f1c2e", border:"1px solid #1e3248", borderRadius:18, padding:32, width:"100%", maxWidth:400 }}>
        {err && <div style={{ background:"rgba(251,113,133,0.1)", border:"1px solid rgba(251,113,133,0.3)", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#fb7185", fontSize:13 }}>{err}</div>}

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:"#64748b", letterSpacing:1, display:"block", marginBottom:7 }}>E-MAIL</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} type="email" placeholder="seu@email.com"
            style={{ width:"100%", padding:"12px 14px", background:"#0a1628", border:"1px solid #1e3248", borderRadius:9, color:"#e2eaf5", fontSize:14, outline:"none", fontFamily:"inherit" }} />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ fontSize:11, color:"#64748b", letterSpacing:1, display:"block", marginBottom:7 }}>SENHA</label>
          <input value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} type="password" placeholder="••••••••"
            style={{ width:"100%", padding:"12px 14px", background:"#0a1628", border:"1px solid #1e3248", borderRadius:9, color:"#e2eaf5", fontSize:14, outline:"none", fontFamily:"inherit" }} />
        </div>

        <button onClick={submit} disabled={loading} style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background: loading ? "#1e3248" : "linear-gradient(135deg,#22d3a5,#0ea5e9)", color: loading ? "#64748b" : "#000", fontSize:15, fontWeight:800, cursor: loading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {loading ? <><span style={{ width:16, height:16, border:"2px solid #475569", borderTopColor:"#94a3b8", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }} /> Entrando...</> : "Entrar →"}
        </button>

        <div style={{ marginTop:20, padding:"14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3248" }}>
          <div style={{ fontSize:11, color:"#475569", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Conta demo</div>
          <div style={{ fontSize:12, color:"#64748b", fontFamily:"monospace" }}>demo@prospectai.com.br</div>
          <div style={{ fontSize:12, color:"#64748b", fontFamily:"monospace" }}>prospect123</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   APP PRINCIPAL
══════════════════════════════════════════════════════════ */
function MainApp({ onLogout }) {
  const [tab, setTab]               = useState("prospector");
  const [ramo, setRamo]             = useState("");
  const [cidade, setCidade]         = useState("");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [erro, setErro]             = useState("");
  const [buscou, setBuscou]         = useState(false);
  const [msgLead, setMsgLead]       = useState(null);
  const [showTpl, setShowTpl]       = useState(false);
  const [template, setTemplate]     = useState(DEFAULT_TPL);
  const [modalCrm, setModalCrm]     = useState(null);
  const nomesRef                    = useRef(new Set());

  /* CRM persistido em localStorage */
  const [crmLeads, setCrmLeadsRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem("prospectai_crm") || "[]"); } catch { return []; }
  });
  const setCrmLeads = useCallback((updater) => {
    setCrmLeadsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("prospectai_crm", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const buscar = useCallback(async (append = false) => {
    if (!ramo.trim() || !cidade.trim()) { setErro("Preencha o ramo e a cidade."); return; }
    setErro("");
    append ? setLoadingMore(true) : setLoading(true);
    if (!append) { setResultados([]); nomesRef.current = new Set(); setBuscou(false); }
    try {
      const excluir = [...nomesRef.current];
      const dados = await buscarLeads(ramo.trim(), cidade.trim(), append ? excluir : []);
      dados.forEach(d => nomesRef.current.add(d.nome));
      setResultados(prev => append ? [...prev, ...dados] : dados);
      setBuscou(true);
    } catch (e) { setErro("Erro: " + e.message); }
    append ? setLoadingMore(false) : setLoading(false);
  }, [ramo, cidade]);

  const addToCRM = useCallback((lead) => {
    if (crmLeads.find(c => c.sourceId === lead.nome)) return;
    setCrmLeads(prev => [...prev, {
      id: `crm_${Date.now()}_${Math.random()}`,
      sourceId: lead.nome, nome: lead.nome,
      whatsapp: lead.whatsapp || null,
      instagram: lead.instagram || null,
      stage: "novo", notes: "",
    }]);
  }, [crmLeads, setCrmLeads]);

  const saveCrm = useCallback((id, stage, notes) => {
    setCrmLeads(prev => prev.map(c => c.id === id ? { ...c, stage, notes } : c));
    setModalCrm(null);
  }, [setCrmLeads]);

  const removeCrm = useCallback((id) => {
    setCrmLeads(prev => prev.filter(c => c.id !== id));
  }, [setCrmLeads]);

  const comWA = resultados.filter(r => r.whatsapp).length;
  const comIG = resultados.filter(r => r.instagram).length;

  return (
    <div style={{ background:"#060f1a", minHeight:"100vh", fontFamily:"'Segoe UI', system-ui, sans-serif", color:"#e2eaf5" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box} a:hover{opacity:0.82}
        input::placeholder{color:#334155} select option{color:#e2eaf5;background:#0f1c2e}
        tbody tr:hover td{background:#0a1628}
      `}</style>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, background:"linear-gradient(135deg,#22d3a5,#0ea5e9)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🎯</div>
            <div>
              <div style={{ fontSize:18, fontWeight:800, letterSpacing:"-0.5px" }}>ProspectAI</div>
              <div style={{ fontSize:11, color:"#475569", fontFamily:"monospace" }}>nome · whatsapp · instagram</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <button onClick={()=>setShowTpl(true)} style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #25d366", background:"rgba(37,211,102,0.07)", color:"#25d366", fontSize:12, cursor:"pointer", fontWeight:600 }}>✏️ Mensagem WA</button>
            <div style={{ display:"flex", gap:4, background:"#0f1c2e", border:"1px solid #1e3248", borderRadius:10, padding:4 }}>
              {["prospector","crm"].map(t => (
                <button key={t} onClick={()=>setTab(t)} style={{ padding:"6px 14px", borderRadius:7, border:"none", cursor:"pointer", background:tab===t?"#22d3a5":"transparent", color:tab===t?"#000":"#64748b", fontWeight:600, fontSize:13, transition:"all 0.2s" }}>
                  {t==="prospector" ? "🔍 Prospectar" : `📊 CRM${crmLeads.length?` (${crmLeads.length})`:""}`}
                </button>
              ))}
            </div>

            <button onClick={onLogout} style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #1e3248", background:"transparent", color:"#475569", fontSize:12, cursor:"pointer" }}>Sair</button>
          </div>
        </div>

        {/* ── PROSPECTAR ─────────────────────────────────────── */}
        {tab==="prospector" && (
          <div>
            <div style={{ background:"#0f1c2e", border:"1px solid #1e3248", borderRadius:14, padding:18, marginBottom:20 }}>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <div style={{ position:"relative", flex:2, minWidth:160 }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16, pointerEvents:"none" }}>🏪</span>
                  <input value={ramo} onChange={e=>setRamo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&buscar(false)} placeholder="Ramo (ex: academia, clínica...)"
                    style={{ width:"100%", padding:"11px 11px 11px 38px", background:"#0a1628", border:"1px solid #1e3248", borderRadius:8, color:"#e2eaf5", fontSize:14, outline:"none", fontFamily:"inherit" }} />
                </div>
                <div style={{ position:"relative", flex:1, minWidth:130 }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16, pointerEvents:"none" }}>📍</span>
                  <input value={cidade} onChange={e=>setCidade(e.target.value)} onKeyDown={e=>e.key==="Enter"&&buscar(false)} placeholder="Cidade"
                    style={{ width:"100%", padding:"11px 11px 11px 38px", background:"#0a1628", border:"1px solid #1e3248", borderRadius:8, color:"#e2eaf5", fontSize:14, outline:"none", fontFamily:"inherit" }} />
                </div>
                <button onClick={()=>buscar(false)} disabled={loading} style={{ padding:"11px 22px", background:loading?"#1e3248":"linear-gradient(135deg,#22d3a5,#0ea5e9)", border:"none", borderRadius:8, color:loading?"#64748b":"#000", fontSize:14, fontWeight:700, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
                  {loading ? <><span style={{ width:15,height:15,border:"2px solid #334155",borderTopColor:"#64748b",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} />Buscando...</> : "⚡ Buscar"}
                </button>
              </div>
            </div>

            {erro && <div style={{ background:"rgba(251,113,133,0.08)", border:"1px solid rgba(251,113,133,0.25)", borderRadius:10, padding:"11px 16px", marginBottom:14, color:"#fb7185", fontSize:13 }}>❌ {erro}</div>}

            {loading && (
              <div style={{ textAlign:"center", padding:"48px 0" }}>
                <div style={{ width:38, height:38, border:"3px solid #1e3248", borderTopColor:"#22d3a5", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
                <div style={{ fontFamily:"monospace", fontSize:13, color:"#22d3a5" }}>Pesquisando no Google...</div>
              </div>
            )}

            {!loading && resultados.length > 0 && (
              <div style={{ display:"flex", gap:12, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:13, color:"#64748b" }}>{resultados.length} resultado{resultados.length>1?"s":""}</span>
                <span style={{ color:"#1e3248" }}>·</span>
                <span style={{ fontSize:13, color:"#25d366" }}>💬 {comWA} WhatsApp</span>
                <span style={{ color:"#1e3248" }}>·</span>
                <span style={{ fontSize:13, color:"#e1306c" }}>📸 {comIG} Instagram</span>
              </div>
            )}

            {!loading && resultados.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
                {resultados.map((r, i) => {
                  const phone = r.whatsapp ? fmtPhone(r.whatsapp) : null;
                  const wa    = r.whatsapp ? waLink(r.whatsapp) : null;
                  const ig    = r.instagram || null;
                  const handle = igHandle(ig);
                  const jaNocrm = !!crmLeads.find(c => c.sourceId === r.nome);
                  return (
                    <div key={i} style={{ background:"#0f1c2e", border:"1px solid #1e3248", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", animation:`fadeIn 0.25s ease ${i*0.04}s both` }}>
                      <div style={{ width:24,height:24,borderRadius:"50%",background:"#0a1628",border:"1px solid #1e3248",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#334155",fontFamily:"monospace",flexShrink:0 }}>{i+1}</div>
                      <div style={{ flex:1, minWidth:130, fontWeight:700, fontSize:14 }}>{r.nome}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, flexWrap:"wrap" }}>
                        {phone ? (
                          <>
                            <span style={{ fontFamily:"monospace", fontSize:13, color:"#e2eaf5" }}>{phone}</span>
                            <CopyBtn value={r.whatsapp} />
                            {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,border:"1px solid #25d36650",background:"rgba(37,211,102,0.08)",color:"#25d366",fontSize:12,fontWeight:700,textDecoration:"none" }}>💬 WA</a>}
                          </>
                        ) : <span style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>—</span>}
                      </div>
                      <div style={{ flexShrink:0 }}>
                        {ig ? (
                          <a href={ig} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,border:"1px solid #e1306c50",background:"rgba(225,48,108,0.08)",color:"#e1306c",fontSize:12,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap" }}>
                            📸 {handle||"Instagram"}
                          </a>
                        ) : <span style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>sem Instagram</span>}
                      </div>
                      <button onClick={()=>setMsgLead(r)} style={{ flexShrink:0,padding:"5px 12px",borderRadius:6,border:"1px solid #1e3248",background:"transparent",color:"#64748b",fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap",transition:"all 0.15s" }}
                        onMouseOver={e=>{e.currentTarget.style.borderColor="#25d366";e.currentTarget.style.color="#25d366";}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor="#1e3248";e.currentTarget.style.color="#64748b";}}>
                        ✉️ Mensagem
                      </button>
                      {jaNocrm ? (
                        <button onClick={()=>setModalCrm(crmLeads.find(c=>c.sourceId===r.nome))} style={{ flexShrink:0,padding:"5px 12px",borderRadius:6,border:"1px solid #22d3a540",background:"rgba(34,211,165,0.06)",color:"#22d3a5",fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap" }}>✅ CRM</button>
                      ) : (
                        <button onClick={()=>addToCRM(r)} style={{ flexShrink:0,padding:"5px 12px",borderRadius:6,border:"1px solid #1e3248",background:"transparent",color:"#64748b",fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap",transition:"all 0.15s" }}
                          onMouseOver={e=>{e.currentTarget.style.borderColor="#22d3a5";e.currentTarget.style.color="#22d3a5";}}
                          onMouseOut={e=>{e.currentTarget.style.borderColor="#1e3248";e.currentTarget.style.color="#64748b";}}>
                          ➕ CRM
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && buscou && (
              <div style={{ textAlign:"center", marginBottom:32 }}>
                <button onClick={()=>buscar(true)} disabled={loadingMore}
                  style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"12px 32px",borderRadius:10,background:"transparent",border:"1px solid #1e3248",color:loadingMore?"#334155":"#64748b",fontSize:14,fontWeight:600,cursor:loadingMore?"not-allowed":"pointer",transition:"all 0.2s" }}
                  onMouseOver={e=>{if(!loadingMore){e.currentTarget.style.borderColor="#22d3a5";e.currentTarget.style.color="#22d3a5";}}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor="#1e3248";e.currentTarget.style.color=loadingMore?"#334155":"#64748b";}}>
                  {loadingMore ? <><span style={{ width:14,height:14,border:"2px solid #334155",borderTopColor:"#64748b",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} />Carregando...</> : "🔄 Carregar mais 10 contatos"}
                </button>
              </div>
            )}

            {!loading && buscou && resultados.length===0 && (
              <div style={{ textAlign:"center",padding:"48px 0",color:"#64748b" }}>
                <div style={{ fontSize:36,marginBottom:10,opacity:0.3 }}>🔍</div>
                <div>Nenhum resultado. Tente outro ramo ou cidade.</div>
              </div>
            )}
            {!loading && !buscou && (
              <div style={{ textAlign:"center",padding:"48px 0",color:"#334155" }}>
                <div style={{ fontSize:36,marginBottom:10,opacity:0.3 }}>🔍</div>
                <div style={{ fontSize:14 }}>Digite o ramo e a cidade para começar</div>
              </div>
            )}
          </div>
        )}

        {/* ── CRM ──────────────────────────────────────────── */}
        {tab==="crm" && (
          crmLeads.length===0 ? (
            <div style={{ textAlign:"center",padding:"60px 24px",color:"#64748b" }}>
              <div style={{ fontSize:44,marginBottom:14,opacity:0.3 }}>📋</div>
              <div>Nenhum lead no CRM ainda.</div>
              <div style={{ fontSize:13,marginTop:8,color:"#334155" }}>Adicione leads da aba Prospectar clicando em ➕ CRM</div>
            </div>
          ) : (
            <div style={{ overflowX:"auto",paddingBottom:8 }}>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(6,minmax(165px,1fr))",gap:12,minWidth:880 }}>
                {Object.entries(STAGES).map(([key,stage])=>{
                  const sl=crmLeads.filter(c=>c.stage===key);
                  return (
                    <div key={key}>
                      <div style={{ padding:"9px 12px",borderRadius:"8px 8px 0 0",marginBottom:8,background:stage.bg,color:stage.color,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                        <span>{stage.label}</span><span style={{ fontFamily:"monospace",opacity:0.8 }}>{sl.length}</span>
                      </div>
                      <div style={{ display:"flex",flexDirection:"column",gap:8,minHeight:80 }}>
                        {sl.length===0 && <div style={{ fontSize:11,color:"#334155",textAlign:"center",padding:"14px 8px",border:"1px dashed #1e3248",borderRadius:8 }}>vazio</div>}
                        {sl.map(lead=>(
                          <div key={lead.id} style={{ background:"#0f1c2e",border:"1px solid #1e3248",borderLeft:`3px solid ${stage.color}`,borderRadius:8,padding:12 }}>
                            <div style={{ fontWeight:700,fontSize:12,marginBottom:4,lineHeight:1.3 }}>{lead.nome}</div>
                            {lead.whatsapp && <div style={{ fontSize:10,color:"#64748b",fontFamily:"monospace",marginBottom:3 }}>{fmtPhone(lead.whatsapp)}</div>}
                            {lead.instagram && (
                              <a href={lead.instagram} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"#e1306c",textDecoration:"none",fontFamily:"monospace",marginBottom:3 }}>
                                📸 {igHandle(lead.instagram)||"Instagram"}
                              </a>
                            )}
                            {lead.notes && <div style={{ fontSize:10,color:"#64748b",marginTop:5,padding:"5px 7px",background:"#0a1628",borderRadius:4,lineHeight:1.4 }}>{lead.notes.slice(0,80)}{lead.notes.length>80?"…":""}</div>}
                            <div style={{ display:"flex",gap:4,marginTop:8 }}>
                              {lead.whatsapp && waLink(lead.whatsapp) && <a href={waLink(lead.whatsapp)} target="_blank" rel="noreferrer" style={{ width:22,height:22,borderRadius:4,border:"1px solid #1e3248",color:"#25d366",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}>💬</a>}
                              <button onClick={()=>setModalCrm(lead)} style={{ width:22,height:22,borderRadius:4,border:"1px solid #1e3248",background:"transparent",color:"#64748b",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✏️</button>
                              <button onClick={()=>removeCrm(lead.id)} style={{ width:22,height:22,borderRadius:4,border:"1px solid #1e3248",background:"transparent",color:"#fb7185",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>


      {msgLead && <MsgModal lead={msgLead} template={template} onClose={()=>setMsgLead(null)} />}
      {showTpl  && <TemplateModal template={template} onClose={()=>setShowTpl(false)} onSave={t=>setTemplate(t)} />}
      {modalCrm && <CrmModal crm={modalCrm} onClose={()=>setModalCrm(null)} onSave={saveCrm} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ROTEADOR RAIZ
══════════════════════════════════════════════════════════ */
export default function Root() {
  const getView = () => {
    try {
      const s = localStorage.getItem("prospectai_session");
      if (s) return "app";
    } catch {}
    return "landing";
  };

  const [view, setView] = useState(getView);

  const logout = () => {
    try { localStorage.removeItem("prospectai_session"); } catch {}
    setView("landing");
  };

  if (view === "app")     return <MainApp onLogout={logout} />;
  if (view === "login")   return <LoginPage onSuccess={()=>setView("app")} onBack={()=>setView("landing")} />;
  return <LandingPage onLogin={()=>setView("login")} />;
}
