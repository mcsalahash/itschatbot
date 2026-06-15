require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');
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

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

app.post('/api/contact', async (req, res) => {
  try {
    const { nom, telephone, email, message, type } = req.body;
    if (!nom || !telephone || !email || !message) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
    }

    const sujet = type === 'inscription'
      ? `[Inscription] Demande de ${nom}`
      : `[Contact] Message de ${nom}`;

    const corps = `
Nouvelle demande reçue via le chatbot Sebti
============================================
Type       : ${type === 'inscription' ? 'Demande d\'inscription' : 'Message à la direction'}
Nom        : ${nom}
Téléphone  : ${telephone}
Email      : ${email}
Date       : ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' })}

Message :
${message}
============================================
`;

    await mailer.sendMail({
      from: `"Chatbot Sebti" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_EMAIL,
      replyTo: email,
      subject: sujet,
      text: corps,
    });

    const logLine = JSON.stringify({ date: new Date().toISOString(), type, nom, telephone, email, message }) + '\n';
    fs.appendFileSync(path.join(__dirname, 'data', 'contacts.log'), logLine);

    console.log(`[contact] ${sujet} — ${email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[server] Erreur /api/contact :', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi. Veuillez réessayer.' });
  }
});

(async () => {
  await refreshContent();
  setInterval(refreshContent, 24 * 60 * 60 * 1000);
  app.listen(PORT, () => {
    console.log(`[server] Chatbot Tahar Sebti démarré sur http://localhost:${PORT}`);
  });
})();
