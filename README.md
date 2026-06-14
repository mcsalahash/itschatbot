# Chatbot visiteurs — Institution Tahar Sebti

Widget de chatbot standalone pour [taharsebti.org](https://taharsebti.org).  
Il scrape automatiquement le contenu du site et répond aux questions des visiteurs via Azure OpenAI.

## Prérequis

- Node.js 18+
- Un déploiement Azure OpenAI (ex : `gpt-4o`)

## Installation

```bash
npm install
cp .env.example .env
# Remplir les variables dans .env
```

## Variables d'environnement (`.env`)

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | URL de votre ressource Azure OpenAI |
| `AZURE_OPENAI_API_KEY` | Clé API Azure OpenAI |
| `AZURE_OPENAI_DEPLOYMENT` | Nom du déploiement (ex : `gpt-4o`) |
| `AZURE_OPENAI_API_VERSION` | Version de l'API (ex : `2024-02-01`) |
| `PORT` | Port du serveur (défaut : `3000`) |
| `SITE_URL` | URL du site à scraper (défaut : `https://taharsebti.org`) |

## Démarrage

```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`.  
Au démarrage, il scrape taharsebti.org et rafraîchit le contenu toutes les 24h.

## Personnaliser le contenu

Modifier uniquement **`data/school-instructions.txt`** — les changements sont pris en compte sans redémarrer le serveur.

## Structure

```
├── server.js                   # Serveur Express + route /api/chat
├── scraper.js                  # Scraping cheerio de taharsebti.org
├── public/
│   ├── chatbot.js              # Widget frontend (vanilla JS)
│   └── chatbot.css             # Styles préfixés .tsb-*
├── data/
│   └── school-instructions.txt # Instructions système de Sebti
├── .env.example
└── package.json
```

## Intégration WordPress

Ajouter dans le footer du thème (ou via "Insert Headers and Footers") :

```html
<link rel="stylesheet" href="https://[URL_CHATBOT]/chatbot.css">
<script>window.TSB_CHATBOT_URL = 'https://[URL_CHATBOT]';</script>
<script src="https://[URL_CHATBOT]/chatbot.js"></script>
```

Remplacer `[URL_CHATBOT]` par l'URL publique de votre serveur (ex : `https://chatbot.taharsebti.org`).
