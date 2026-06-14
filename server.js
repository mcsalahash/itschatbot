require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const rateLimit = require('express-rate-limit');
const { scrapeFullSite } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
});

let scrapedContent = '';

function buildSystemPrompt() {
  const instructionsPath = path.join(__dirname, 'data', 'school-instructions.txt');
  const instructions = fs.readFileSync(instructionsPath, 'utf-8');
  const placeholder = '[Ce bloc est remplacé dynamiquement par le scraper au démarrage du serveur]';
  return instructions.replace(placeholder, scrapedContent || '(Aucun contenu extrait du site pour le moment.)');
}

async function refreshContent() {
  console.log('[server] Démarrage du scraping...');
  scrapedContent = await scrapeFullSite();
  console.log('[server] Contenu mis à jour.');
}

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ['https://taharsebti.org', 'http://localhost:3000'];
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer dans quelques minutes.' },
});
app.use('/api/', limiter);

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages invalides.' });
    }

    const sanitized = messages
      .filter(m => m && typeof m.role === 'string' && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }));

    const recent = sanitized.slice(-10);

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        ...recent,
      ],
      max_tokens: 500,
    });

    const reply = response.choices[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    console.error('[server] Erreur /api/chat :', err.message);
    res.status(500).json({ error: 'Erreur serveur, réessayez dans un moment.' });
  }
});

(async () => {
  await refreshContent();
  setInterval(refreshContent, 24 * 60 * 60 * 1000);
  app.listen(PORT, () => {
    console.log(`[server] Chatbot Tahar Sebti démarré sur http://localhost:${PORT}`);
  });
})();
