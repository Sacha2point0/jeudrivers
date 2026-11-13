'use strict';

/*
 * Serveur du jeu « En voiture ! » (Le permis de manager).
 * Node.js seul, sans dépendance. Temps réel par Server-Sent Events
 * (le serveur pousse l'état à chaque téléphone) et actions par POST.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Salle } = require('./src/salle');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const salles = new Map();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function json(res, statut, donnees) {
  res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(donnees));
}

function lireCorps(req) {
  return new Promise((resolve, reject) => {
    let corps = '';
    req.on('data', (morceau) => {
      corps += morceau;
      if (corps.length > 10000) {
        reject(new Error('Requête trop longue.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(corps ? JSON.parse(corps) : {});
      } catch {
        reject(new Error('Requête illisible.'));
      }
    });
  });
}

function nouveauCode() {
  for (let i = 0; i < 1000; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!salles.has(code)) return code;
  }
  throw new Error('Plus de salle disponible.');
}

function nettoyerNom(nom) {
  const n = String(nom || '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!n) throw new Error('Indique ton prénom.');
  return n;
}

function servirFichier(req, res, chemin) {
  const fichier = path.normalize(path.join(PUBLIC, chemin));
  if (!fichier.startsWith(PUBLIC)) return json(res, 403, { erreur: 'Interdit.' });
  fs.readFile(fichier, (err, contenu) => {
    if (err) {
      // Toute autre adresse renvoie l'application (ex. /1234 pour rejoindre).
      if (path.extname(chemin)) return json(res, 404, { erreur: 'Introuvable.' });
      return servirFichier(req, res, '/index.html');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(contenu);
  });
}

function flux(req, res, salle, jid) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // pas de mise en tampon par le proxy
  });
  res.write('retry: 1500\n\n');
  salle.brancher(jid, res);
  const battement = setInterval(() => res.write(': ok\n\n'), 15000);
  req.on('close', () => {
    clearInterval(battement);
    salle.debrancher(jid, res);
  });
}

async function api(req, res, url) {
  const morceaux = url.pathname.split('/').filter(Boolean); // ['api', 'salles', code, action]
  const code = morceaux[2];
  const action = morceaux[3];

  // Créer une salle
  if (req.method === 'POST' && morceaux.length === 2 && morceaux[1] === 'salles') {
    const corps = await lireCorps(req);
    const nom = nettoyerNom(corps.nom);
    const salle = new Salle(nouveauCode());
    salles.set(salle.code, salle);
    const joueur = salle.ajouterJoueur(nom);
    return json(res, 200, { code: salle.code, joueur });
  }

  const salle = salles.get(code);
  if (!salle) return json(res, 404, { erreur: 'Cette partie n’existe pas (ou plus).' });

  if (req.method === 'GET' && action === 'flux') {
    const jid = url.searchParams.get('joueur');
    if (!salle.joueurs.has(jid)) {
      // L'événement « erreur » indique au téléphone de revenir à l'accueil.
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end('event: erreur\ndata: "Tu ne fais plus partie de cette partie."\n\n');
    }
    return flux(req, res, salle, jid);
  }

  if (req.method !== 'POST') return json(res, 405, { erreur: 'Méthode non autorisée.' });
  const corps = await lireCorps(req);

  if (action === 'rejoindre') {
    const joueur = salle.ajouterJoueur(nettoyerNom(corps.nom));
    return json(res, 200, { code: salle.code, joueur });
  }

  const jid = corps.joueur;
  if (!salle.joueurs.has(jid)) return json(res, 403, { erreur: 'Joueur inconnu dans cette partie.' });

  switch (action) {
    case 'lancer':
      salle.lancer(jid);
      salle.diffuser();
      return json(res, 200, { ok: true });
    case 'action':
      salle.action(jid, String(corps.commande), corps.valeur == null ? null : String(corps.valeur));
      return json(res, 200, { ok: true });
    case 'quitter':
      salle.retirerJoueur(jid);
      salle.diffuser();
      return json(res, 200, { ok: true });
    default:
      return json(res, 404, { erreur: 'Action inconnue.' });
  }
}

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/sante') return json(res, 200, { ok: true, salles: salles.size });
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { erreur: 'Méthode non autorisée.' });
    return servirFichier(req, res, url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
  } catch (err) {
    if (!res.headersSent) json(res, 400, { erreur: err.message });
  }
});

// Horloge du jeu : 5 fois par seconde, plus un rafraîchissement complet chaque seconde.
let tics = 0;
setInterval(() => {
  tics += 1;
  for (const salle of salles.values()) {
    if (tics % 5 === 0 && salle.phase === 'jeu') salle.signaler();
    salle.tic();
  }
}, 200);

// Ménage : une salle sans joueur connecté depuis 2 h est supprimée.
setInterval(() => {
  const limite = Date.now() - 2 * 3600 * 1000;
  for (const [code, salle] of salles) {
    const connectes = [...salle.joueurs.values()].some((j) => j.flux.size > 0);
    if (!connectes && salle.derniereActivite < limite) salles.delete(code);
  }
}, 60 * 1000);

serveur.listen(PORT, () => {
  console.log(`Jeu « En voiture ! » sur http://localhost:${PORT}`);
});
