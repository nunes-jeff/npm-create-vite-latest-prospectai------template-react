/**
 * Vercel Serverless Function — /api/search
 *
 * Recebe { ramo, cidade, excluir[] } do frontend,
 * faz a chamada à API da Anthropic com web_search,
 * e devolve { resultados[] } sem expor a chave ao browser.
 *
 * Variável de ambiente necessária na Vercel:
 *   ANTHROPIC_API_KEY = sk-ant-api03-...
 */

export const config = { runtime: "edge" }; // Edge runtime — mais rápido e barato

export default async function handler(req) {
  // Só aceita POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Lê e valida o body
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { ramo, cidade, excluir = [] } = body;

  if (!ramo || !cidade) {
    return new Response(JSON.stringify({ error: "ramo e cidade são obrigatórios" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Chave da API não configurada" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Monta o prompt
  const excStr = excluir.length
    ? `\nNão retorne estabelecimentos com estes nomes já listados: ${excluir.slice(0, 40).join(", ")}.`
    : "";

  const prompt = `Faça uma busca no Google por estabelecimentos de "${ramo}" em "${cidade}", Brasil.${excStr}

Para cada resultado encontrado, extraia:
- Nome do estabelecimento
- Número de WhatsApp ou telefone (formato brasileiro)
- URL do perfil no Instagram (se encontrar)

Retorne SOMENTE JSON puro, sem markdown:
{"resultados":[{"nome":"Nome","whatsapp":"(11) 99999-9999","instagram":"https://instagram.com/perfil"}]}

Regras:
- Busque em Google Maps, Instagram, sites das empresas
- Retorne até 10 resultados DIFERENTES dos já listados
- whatsapp: número encontrado ou null
- instagram: URL encontrada ou null
- Apenas negócios reais`;

  // Chama a Anthropic
  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao conectar à Anthropic: " + err.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!anthropicRes.ok) {
    const errData = await anthropicRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ error: errData?.error?.message || `Anthropic HTTP ${anthropicRes.status}` }), {
      status: anthropicRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await anthropicRes.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    return new Response(JSON.stringify({ resultados: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let resultados = [];
  try {
    resultados = JSON.parse(match[0]).resultados || [];
  } catch {
    resultados = [];
  }

  return new Response(JSON.stringify({ resultados }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
