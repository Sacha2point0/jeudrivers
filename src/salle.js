'use strict';

const crypto = require('crypto');
const COMMANDES = require('../content/commandes');
const REGLES = require('../content/regles');

const PAR_ID = new Map(COMMANDES.map((c) => [c.id, c]));
const DELAI_HORS_LIGNE = 8000; // au-delà, un joueur déconnecté est mis de côté

function hasard(min, max) {
  return min + Math.random() * (max - min);
}

function melanger(liste) {
  const l = liste.slice();
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/*
 * Une salle = un équipage = une voiture.
 * Phases : « attente » (salle ouverte), « jeu », « fin ».
 * Le serveur fait foi : chrono, réussites, accidents et vies sont calculés ici.
 */
class Salle {
  constructor(code) {
    this.code = code;
    this.phase = 'attente';
    this.joueurs = new Map(); // id -> joueur
    this.ordre = []; // ordre d'arrivée des ids
    this.hoteId = null;
    this.evenements = [];
    this.numEvenement = 0;
    this.derniereActivite = Date.now();
    this.partie = null;
    this.sale = false;
  }

  // ---------- Joueurs ----------

  ajouterJoueur(nom) {
    if (this.phase === 'jeu') throw new Error('La partie a déjà commencé.');
    if (this.joueurs.size >= REGLES.joueursMax) throw new Error(`L'équipage est complet (${REGLES.joueursMax} joueurs).`);
    const id = crypto.randomUUID();
    this.joueurs.set(id, { id, nom, flux: new Set(), horsLigneDepuis: Date.now() });
    this.ordre.push(id);
    if (!this.hoteId) this.hoteId = id;
    this.signaler();
    return id;
  }

  retirerJoueur(id) {
    if (this.phase === 'jeu' || !this.joueurs.has(id)) return;
    for (const res of this.joueurs.get(id).flux) res.end();
    this.joueurs.delete(id);
    this.ordre = this.ordre.filter((x) => x !== id);
    if (this.hoteId === id) this.hoteId = this.ordre[0] || null;
    this.signaler();
  }

  enLigne(j, maintenant = Date.now()) {
    return j.flux.size > 0 || maintenant - j.horsLigneDepuis < DELAI_HORS_LIGNE;
  }

  brancher(id, res) {
    const j = this.joueurs.get(id);
    j.flux.add(res);
    this.derniereActivite = Date.now();
    this.envoyerA(j);
    this.signaler();
  }

  debrancher(id, res) {
    const j = this.joueurs.get(id);
    if (!j) return;
    j.flux.delete(res);
    if (j.flux.size === 0) j.horsLigneDepuis = Date.now();
    this.signaler();
  }

  // Si l'hôte a disparu, le plus ancien joueur connecté prend le relais.
  verifierHote() {
    const hote = this.joueurs.get(this.hoteId);
    if (hote && this.enLigne(hote)) return;
    const relais = this.ordre.map((id) => this.joueurs.get(id)).find((j) => j.flux.size > 0);
    if (relais && relais.id !== this.hoteId) {
      this.hoteId = relais.id;
      this.signaler();
    }
  }

  estHote(id) {
    this.verifierHote();
    return id === this.hoteId;
  }

  // ---------- Partie ----------

  lancer(id) {
    if (!this.estHote(id)) throw new Error("Seul l'hôte peut lancer la partie.");
    if (this.phase === 'jeu') return;
    const presents = this.ordre.filter((x) => this.enLigne(this.joueurs.get(x)));
    if (presents.length < REGLES.joueursMin) throw new Error(`Il faut au moins ${REGLES.joueursMin} joueurs connectés.`);

    // Distribution des commandes : on prend les premières de la liste,
    // on les mélange et on les distribue à tour de rôle.
    const parJoueur = REGLES.commandesParJoueur(presents.length);
    const nb = Math.min(COMMANDES.length, presents.length * parJoueur);
    const choisies = melanger(COMMANDES.slice(0, nb).map((c) => c.id));
    const proprietaire = {};
    const etat = {};
    const ordreJoueurs = melanger(presents);
    choisies.forEach((cid, i) => {
      proprietaire[cid] = ordreJoueurs[i % ordreJoueurs.length];
      const c = PAR_ID.get(cid);
      if (c.type === 'choix') etat[cid] = c.initial;
    });

    const maintenant = Date.now();
    const pause = {};
    melanger(presents).forEach((jid, i) => {
      pause[jid] = maintenant + 2500 + i * 1200; // démarrage progressif
    });

    this.partie = {
      joueurs: presents,
      proprietaire,
      etat,
      consignes: new Map(), // id du joueur qui crie -> consigne
      pause,
      vies: REGLES.vies,
      score: 0,
      niveau: 1,
      reussites: 0,
      accidents: 0,
      distance: 0, // en mètres
      debut: maintenant,
      dernierTic: maintenant,
      accidentJusqua: 0,
      numConsigne: 0,
    };
    this.phase = 'jeu';
    this.evenements = [];
    this.evenement('depart', 'Attachez vos ceintures, c’est parti !');
    this.signaler();
  }

  commandesDe(jid) {
    const p = this.partie;
    return Object.keys(p.proprietaire).filter((cid) => p.proprietaire[cid] === jid);
  }

  action(jid, cid, valeur) {
    const p = this.partie;
    if (this.phase !== 'jeu' || !p) return;
    if (p.proprietaire[cid] !== jid) throw new Error("Cette commande n'est pas à toi.");
    const c = PAR_ID.get(cid);
    if (c.type === 'choix') {
      if (!c.valeurs.some((v) => v.id === valeur)) throw new Error('Position inconnue.');
      p.etat[cid] = valeur;
    }
    this.derniereActivite = Date.now();

    // Une consigne en cours sur cette commande est-elle satisfaite ?
    for (const [crieur, consigne] of p.consignes) {
      if (consigne.commande !== cid) continue;
      if (c.type === 'choix' && consigne.valeur !== valeur) continue;
      this.reussite(crieur, consigne, jid);
    }
    this.signaler();
    this.diffuser();
  }

  reussite(crieur, consigne, acteur) {
    const p = this.partie;
    p.consignes.delete(crieur);
    p.score += REGLES.points(p.niveau);
    p.reussites += 1;
    p.pause[crieur] = Date.now() + hasard(...REGLES.pauseEntreConsignes);
    this.evenement('reussite', 'Bien joué !', [crieur, acteur]);
    if (p.reussites % REGLES.reussitesParNiveau === 0 && p.niveau < REGLES.niveauMax) {
      p.niveau += 1;
      this.evenement('niveau', `Ça accélère : ${REGLES.vitesse(p.niveau)} km/h !`);
    }
  }

  accident(consigne) {
    const p = this.partie;
    const maintenant = Date.now();
    p.vies -= 1;
    p.accidents += 1;
    p.consignes.clear();
    // On ne nomme personne : l'accident est celui de l'équipage.
    this.evenement('accident', `« ${consigne.texte} » n'a pas été fait à temps.`);
    if (p.vies <= 0) {
      this.phase = 'fin';
      p.fin = maintenant;
      this.evenement('fin', 'Fin de la route.');
      return;
    }
    p.accidentJusqua = maintenant + REGLES.pauseAccident;
    for (const jid of p.joueurs) {
      p.pause[jid] = p.accidentJusqua + hasard(500, 3000);
    }
  }

  // Appelé régulièrement par le serveur.
  tic(maintenant = Date.now()) {
    this.verifierHote();
    const p = this.partie;
    if (this.phase === 'jeu' && p) {
      const dt = maintenant - p.dernierTic;
      p.dernierTic = maintenant;
      if (maintenant >= p.accidentJusqua) {
        p.distance += (REGLES.vitesse(p.niveau) / 3.6) * (dt / 1000);

        // Consignes expirées : accident (une seule à la fois).
        for (const consigne of p.consignes.values()) {
          if (maintenant > consigne.echeance) {
            this.accident(consigne);
            this.signaler();
            break;
          }
        }
        if (this.phase === 'jeu') this.distribuerConsignes(maintenant);
      }
    }
    if (this.sale) this.diffuser();
  }

  distribuerConsignes(maintenant) {
    const p = this.partie;
    const presents = p.joueurs.filter((jid) => this.enLigne(this.joueurs.get(jid), maintenant));
    const max = REGLES.consignesSimultanees(p.niveau, presents.length);
    if (p.consignes.size >= max) return;

    for (const crieur of melanger(presents)) {
      if (p.consignes.size >= max) break;
      if (p.consignes.has(crieur) || maintenant < (p.pause[crieur] || 0)) continue;

      // Une commande d'un autre joueur connecté, sans consigne en cours.
      const prises = new Set([...p.consignes.values()].map((x) => x.commande));
      const possibles = Object.keys(p.proprietaire).filter((cid) => {
        const prop = p.proprietaire[cid];
        return prop !== crieur && !prises.has(cid) && presents.includes(prop);
      });
      if (possibles.length === 0) continue;

      const cid = possibles[Math.floor(Math.random() * possibles.length)];
      const c = PAR_ID.get(cid);
      let valeur = null;
      let texte;
      if (c.type === 'choix') {
        const autres = c.valeurs.filter((v) => v.id !== p.etat[cid]);
        const v = autres[Math.floor(Math.random() * autres.length)];
        valeur = v.id;
        texte = v.consigne;
      } else {
        texte = c.consignes[Math.floor(Math.random() * c.consignes.length)];
      }
      const duree = REGLES.dureeConsigne(p.niveau);
      p.numConsigne += 1;
      p.consignes.set(crieur, {
        num: p.numConsigne, commande: cid, valeur, texte, duree, echeance: maintenant + duree,
      });
      this.signaler();
    }
  }

  // ---------- Diffusion ----------

  evenement(type, texte, pour = null) {
    this.numEvenement += 1;
    this.evenements.push({ num: this.numEvenement, type, texte, pour });
    if (this.evenements.length > 20) this.evenements.shift();
  }

  signaler() {
    this.sale = true;
  }

  diffuser() {
    this.sale = false;
    for (const j of this.joueurs.values()) this.envoyerA(j);
  }

  envoyerA(j) {
    if (j.flux.size === 0) return;
    const donnees = `data: ${JSON.stringify(this.vue(j.id))}\n\n`;
    for (const res of j.flux) res.write(donnees);
  }

  // Ce que voit un joueur donné.
  vue(jid) {
    const maintenant = Date.now();
    const p = this.partie;
    const vue = {
      phase: this.phase,
      code: this.code,
      moi: { id: jid, nom: this.joueurs.get(jid).nom, hote: jid === this.hoteId },
      joueurs: this.ordre.map((id) => {
        const j = this.joueurs.get(id);
        return { nom: j.nom, hote: id === this.hoteId, enLigne: this.enLigne(j, maintenant), moi: id === jid };
      }),
      regles: { min: REGLES.joueursMin, max: REGLES.joueursMax },
      evenements: this.evenements
        .filter((e) => !e.pour || e.pour.includes(jid))
        .map(({ num, type, texte }) => ({ num, type, texte })),
    };
    if (!p) return vue;

    vue.partie = {
      vies: p.vies,
      viesMax: REGLES.vies,
      score: p.score,
      niveau: p.niveau,
      vitesse: REGLES.vitesse(p.niveau),
      distance: Math.round(p.distance),
      reussites: p.reussites,
      accidents: p.accidents,
      duree: Math.round(((p.fin || maintenant) - p.debut) / 1000),
      accident: Math.max(0, p.accidentJusqua - maintenant),
      joue: p.joueurs.includes(jid),
    };

    vue.commandes = this.commandesDe(jid).map((cid) => {
      const c = PAR_ID.get(cid);
      return {
        id: c.id, nom: c.nom, icone: c.icone, type: c.type, bouton: c.bouton,
        valeurs: c.valeurs ? c.valeurs.map((v) => ({ id: v.id, label: v.label })) : undefined,
        valeur: p.etat[cid],
      };
    });

    const consigne = p.consignes.get(jid);
    vue.consigne = consigne && this.phase === 'jeu'
      ? { num: consigne.num, texte: consigne.texte, restant: Math.max(0, consigne.echeance - maintenant), duree: consigne.duree }
      : null;
    return vue;
  }
}

module.exports = { Salle };
