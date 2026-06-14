const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = process.env.SITE_URL || 'https://taharsebti.org';

const PAGES = ['/', '/qui-sommes-nous', '/structures', '/projets', '/nous-soutenir', '/partenaires', '/contact'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapePage(path) {
  const url = `${BASE_URL}${path}`;
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      console.warn(`[scraper] Échec ${response.status} pour ${url}`);
      return '';
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    $('nav, footer, script, style, #wpadminbar, .wp-block-navigation').remove();

    const sections = [];
    $('main, .entry-content, article').each((_, container) => {
      $(container).find('h1, h2, h3, p, li').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length >= 20) {
          sections.push(text);
        }
      });
    });

    if (sections.length === 0) {
      $('h1, h2, h3, p, li').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length >= 20) {
          sections.push(text);
        }
      });
    }

    const label = path === '/' ? 'Page d\'accueil' : path.replace('/', '').replace(/-/g, ' ');
    return sections.length > 0 ? `\n--- ${label} ---\n${sections.join('\n')}` : '';
  } catch (err) {
    console.warn(`[scraper] Erreur lors du scraping de ${url} :`, err.message);
    return '';
  }
}

async function scrapeFullSite() {
  const results = [];
  for (const path of PAGES) {
    const content = await scrapePage(path);
    if (content) results.push(content);
    await sleep(500);
  }
  const combined = results.join('\n');
  if (combined.trim().length === 0) {
    console.warn('[scraper] Aucun contenu extrait du site. Utilisation des instructions de base uniquement.');
    return '';
  }
  console.log(`[scraper] Contenu extrait : ${combined.length} caractères depuis ${results.length} page(s).`);
  return combined;
}

module.exports = { scrapeFullSite };
