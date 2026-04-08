# 🎯 ProspectAI

> Encontre clientes com WhatsApp e Instagram em segundos.

## Stack

- **Frontend:** React + Vite
- **Backend:** Vercel Serverless Function (`/api/search.js`)
- **IA:** Anthropic Claude com web_search
- **Hospedagem:** Vercel (gratuito para começar)

---

## 🚀 Deploy em 5 passos

### 1. Clone e instale as dependências

```bash
git clone https://github.com/SEU_USUARIO/prospectai.git
cd prospectai
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Abra o `.env` e preencha:

```
ANTHROPIC_API_KEY=sk-ant-api03-SUA_CHAVE_AQUI
```

Obtenha sua chave em: https://console.anthropic.com

### 3. Rode localmente

```bash
npm run dev
```

> ⚠️ Para testar a `/api/search` localmente, instale a Vercel CLI:
> ```bash
> npm i -g vercel
> vercel dev
> ```
> Isso sobe o frontend + as serverless functions juntos na porta 3000.

### 4. Suba para o GitHub

```bash
git init
git add .
git commit -m "feat: ProspectAI inicial"
git remote add origin https://github.com/SEU_USUARIO/prospectai.git
git push -u origin main
```

### 5. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **"Add New Project"** e selecione o repositório `prospectai`
3. Antes de confirmar o deploy, vá em **"Environment Variables"** e adicione:
   - `ANTHROPIC_API_KEY` → sua chave da Anthropic
4. Clique em **Deploy**

✅ Pronto! Seu app estará disponível em `https://prospectai.vercel.app`

---

## 🔐 Conta demo

Para acessar o app de demonstração, use:

| Campo | Valor |
|-------|-------|
| E-mail | `demo@prospectai.com.br` |
| Senha | `prospect123` |

A conta demo tem limite de 10 leads por busca.
Para liberar acesso ilimitado, crie uma conta premium.

---

## 🌐 Domínio personalizado

1. Compre seu domínio em [registro.br](https://registro.br) (~R$ 40/ano)
2. No painel da Vercel → **Settings → Domains**
3. Adicione seu domínio e siga as instruções de DNS

---

## 💳 Integração com pagamento

Para vender o acesso premium, integre com:

- **[Hotmart](https://hotmart.com)** — mais popular no Brasil, sem código
- **[Kiwify](https://kiwify.com.br)** — alternativa nacional simples
- **[Stripe](https://stripe.com)** — internacional, mais controle técnico

O fluxo recomendado:
1. Usuário compra no Hotmart/Kiwify
2. Plataforma chama um webhook no seu backend
3. Webhook cria a conta real no Supabase com `is_premium = true`
4. Usuário recebe e-mail com login e senha

---

## 📁 Estrutura do projeto

```
prospectai/
├── api/
│   └── search.js          ← Serverless Function (protege a chave da API)
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx           ← Entry point React
│   └── App.jsx            ← Aplicação completa (landing, login, app, CRM)
├── .env.example           ← Template de variáveis de ambiente
├── .gitignore
├── index.html
├── package.json
├── vercel.json            ← Configuração de deploy
└── vite.config.js
```

---

## 🔧 Próximos passos sugeridos

- [ ] Integrar [Supabase Auth](https://supabase.com) para autenticação real por e-mail
- [ ] Salvar CRM no banco (Supabase Postgres) em vez de localStorage
- [ ] Webhook de pagamento para ativar contas premium automaticamente
- [ ] Painel admin para gerenciar usuários

---

Feito com ❤️ e IA.
