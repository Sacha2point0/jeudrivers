'use strict';

/*
 * Simulation d'un équipage de robots, pour tester le serveur sans téléphone.
 *
 *   node tools/simulation.js [adresse] [joueurs] [taux de réussite] [durée en s]
 *   node tools/simulation.js http://localhost:3000 6 0.9 40
 *
 * Chaque robot lit sa consigne, retrouve qui a la commande concernée et le fait
 * agir après un délai, sauf dans (1 - taux) des cas, pour provoquer des accidents.
 */
const COMMANDES = require('../content/commandes');

const ADRESSE = process.argv[2] || 'http://localhost:3000';
const NB = Number(process.argv[3] || 4);
const TAUX = Number(process.argv[4] || 0.9);
const DUREE = Number(process.argv[5] || 30) * 1000;

// Texte de consigne -> { commande, valeur }
const PAR_TEXTE = new Map();
for (const c of COMMANDES) {
  if (c.type === 'choix') for (const v of c.valeurs) PAR_TEXTE.set(v.consigne, { commande: c.id, valeur: v.id });
  else for (const t of c.consignes) PAR_TEXTE.set(t, { commande: c.id, valeur: null });
}

async function post(chemin, corps) {
  const r = await fetch(ADRESSE + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.erreur);
  return d;
}

async function ecouter(robot, code) {
  const r = await fetch(`${ADRESSE}/api/salles/${code}/flux?joueur=${robot.joueur}`, { signal: robot.arret.signal });
  const lecteur = r.body.getReader();
  const dec = new TextDecoder();
  let tampon = '';
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += dec.decode(value, { stream: true });
      let i;
      while ((i = tampon.indexOf('\n\n')) >= 0) {
        const bloc = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const ligne = bloc.split('\n').find((l) => l.startsWith('data: '));
        if (ligne) robot.vue = JSON.parse(ligne.slice(6));
      }
    }
  } catch { /* arrêt */ }
}

async function principal() {
  const hote = await post('/api/salles', { nom: 'Robot 1' });
  const code = hote.code;
  const robots = [{ nom: 'Robot 1', joueur: hote.joueur }];
  for (let i = 2; i <= NB; i++) {
    const r = await post(`/api/salles/${code}/rejoindre`, { nom: `Robot ${i}` });
    robots.push({ nom: `Robot ${i}`, joueur: r.joueur });
  }
  for (const r of robots) {
    r.arret = new AbortController();
    r.traitees = new Set();
    ecouter(r, code);
  }
  console.log(`Salle ${code} : ${NB} robots, taux de réussite ${TAUX}. Rejoignez-la sur ${ADRESSE}/${code} pour regarder.`);
  await new Promise((ok) => setTimeout(ok, 800));
  await post(`/api/salles/${code}/lancer`, { joueur: hote.joueur });

  const debut = Date.now();
  let dernierAffichage = 0;
  while (Date.now() - debut < DUREE) {
    await new Promise((ok) => setTimeout(ok, 100));
    for (const r of robots) {
      const c = r.vue && r.vue.consigne;
      if (!c || r.traitees.has(c.num)) continue;
      r.traitees.add(c.num);
      const cible = PAR_TEXTE.get(c.texte);
      if (!cible) { console.log('Consigne inconnue :', c.texte); continue; }
      const proprietaire = robots.find((x) => x.vue && (x.vue.commandes || []).some((k) => k.id === cible.commande));
      if (!proprietaire) { console.log('Personne n’a la commande', cible.commande); continue; }
      if (proprietaire === r) console.log('ERREUR : consigne reçue pour sa propre commande', cible.commande);
      if (Math.random() > TAUX) continue; // on « oublie » : accident attendu
      setTimeout(() => {
        post(`/api/salles/${code}/action`, { joueur: proprietaire.joueur, ...cible }).catch((e) => console.log('Action refusée :', e.message));
      }, 500 + Math.random() * 2500);
    }
    const v = robots[0].vue;
    if (v && v.partie && Date.now() - dernierAffichage > 3000) {
      dernierAffichage = Date.now();
      const p = v.partie;
      console.log(`${v.phase} · vies ${p.vies} · score ${p.score} · niveau ${p.niveau} · ${p.vitesse} km/h · ${p.distance} m · réussites ${p.reussites}`);
      if (v.phase === 'fin') break;
    }
  }
  const p = robots[0].vue.partie;
  console.log(`Bilan : phase ${robots[0].vue.phase}, score ${p.score}, réussites ${p.reussites}, accidents ${p.accidents}.`);
  console.log('Commandes par robot :', robots.map((r) => `${r.nom}=${(r.vue.commandes || []).map((c) => c.id).join('+')}`).join(' · '));
  for (const r of robots) r.arret.abort();
}

principal().catch((e) => { console.error(e); process.exit(1); });
