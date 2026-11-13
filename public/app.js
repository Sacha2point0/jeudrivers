'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const CLE = 'enVoiture';

  // La session est gardée par onglet : on peut tester à plusieurs onglets sur un même ordinateur.
  let session = lireSession();
  let source = null;
  let vue = null;
  let signatureCommandes = '';
  let numConsigne = null;
  let echeance = 0;
  let dureeConsigne = 1;
  let dernierEvenement = null;
  let enAccident = false;

  function lireSession() {
    try { return JSON.parse(sessionStorage.getItem(CLE)) || null; } catch { return null; }
  }
  function ecrireSession(s) {
    session = s;
    try {
      if (s) sessionStorage.setItem(CLE, JSON.stringify(s));
      else sessionStorage.removeItem(CLE);
    } catch { /* stockage indisponible : la session reste en mémoire */ }
  }

  async function appel(chemin, corps) {
    const res = await fetch(chemin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps || {}),
    });
    const donnees = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(donnees.erreur || 'Le serveur ne répond pas.');
    return donnees;
  }

  function afficher(ecran) {
    for (const id of ['accueil', 'attente', 'jeu', 'fin']) $('ecran-' + id).hidden = id !== ecran;
  }

  // ---------- Accueil ----------

  const codeDansAdresse = (location.pathname.match(/^\/(\d{4})$/) || [])[1]
    || new URLSearchParams(location.search).get('code');
  if (codeDansAdresse) $('code').value = codeDansAdresse;
  try { $('nom').value = localStorage.getItem(CLE + '.nom') || ''; } catch { /* rien */ }

  $('form-accueil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = e.submitter ? e.submitter.dataset.action : 'rejoindre';
    const nom = $('nom').value.trim();
    const code = $('code').value.trim();
    $('erreur-accueil').textContent = '';
    if (!nom) { $('erreur-accueil').textContent = 'Indique ton prénom.'; return; }
    if (action === 'rejoindre' && !/^\d{4}$/.test(code)) {
      $('erreur-accueil').textContent = 'Saisis le code à 4 chiffres, ou crée une nouvelle partie.';
      return;
    }
    try { localStorage.setItem(CLE + '.nom', nom); } catch { /* rien */ }
    try {
      const r = action === 'creer'
        ? await appel('/api/salles', { nom })
        : await appel(`/api/salles/${code}/rejoindre`, { nom });
      ecrireSession({ code: r.code, joueur: r.joueur });
      history.replaceState(null, '', '/' + r.code);
      connecter();
    } catch (err) {
      $('erreur-accueil').textContent = err.message;
    }
  });

  // ---------- Connexion temps réel ----------

  function connecter() {
    if (source) source.close();
    if (!session) { afficher('accueil'); return; }
    source = new EventSource(`/api/salles/${session.code}/flux?joueur=${encodeURIComponent(session.joueur)}`);
    source.onmessage = (e) => rendre(JSON.parse(e.data));
    source.addEventListener('erreur', () => quitterLocalement());
    source.onerror = () => {
      // EventSource se reconnecte tout seul ; si la salle a disparu, le serveur renvoie 404.
      if (source.readyState === EventSource.CLOSED) setTimeout(verifierSalle, 1500);
    };
  }

  async function verifierSalle() {
    if (!session) return;
    const res = await fetch(`/api/salles/${session.code}/flux?joueur=x`, { method: 'HEAD' }).catch(() => null);
    if (res && res.status === 404) quitterLocalement('Cette partie n’existe plus.');
    else connecter();
  }

  function quitterLocalement(message) {
    if (source) source.close();
    source = null;
    ecrireSession(null);
    vue = null;
    signatureCommandes = '';
    history.replaceState(null, '', '/');
    afficher('accueil');
    $('erreur-accueil').textContent = typeof message === 'string' ? message : '';
  }

  async function quitter() {
    if (session) await appel(`/api/salles/${session.code}/quitter`, { joueur: session.joueur }).catch(() => {});
    quitterLocalement();
  }
  $('bouton-quitter').addEventListener('click', quitter);
  $('bouton-quitter-fin').addEventListener('click', quitter);

  async function lancer(erreurId) {
    $(erreurId).textContent = '';
    try { await appel(`/api/salles/${session.code}/lancer`, { joueur: session.joueur }); }
    catch (err) { $(erreurId).textContent = err.message; }
  }
  $('bouton-lancer').addEventListener('click', () => lancer('erreur-attente'));
  $('bouton-rejouer').addEventListener('click', () => lancer('erreur-fin'));

  // ---------- Rendu ----------

  function rendre(v) {
    vue = v;
    traiterEvenements(v.evenements);
    if (v.phase === 'attente') rendreAttente(v);
    else if (v.phase === 'jeu') rendreJeu(v);
    else rendreFin(v);
  }

  function rendreAttente(v) {
    afficher('attente');
    signatureCommandes = '';
    $('attente-code').textContent = v.code;
    $('attente-adresse').textContent = location.host;
    const presents = v.joueurs.filter((j) => j.enLigne).length;
    $('attente-compte').textContent = `${v.joueurs.length} / ${v.regles.max}`;
    $('attente-joueurs').replaceChildren(...v.joueurs.map((j) => {
      const li = document.createElement('li');
      li.textContent = j.nom + (j.hote ? ' · hôte' : '') + (j.moi ? ' (toi)' : '');
      if (j.moi) li.classList.add('moi');
      if (!j.enLigne) li.classList.add('absent');
      return li;
    }));
    $('bouton-lancer').hidden = !v.moi.hote;
    $('bouton-lancer').disabled = presents < v.regles.min;
    $('attente-message').textContent = v.moi.hote
      ? (presents < v.regles.min ? `Il faut au moins ${v.regles.min} joueurs pour partir.` : 'Tout le monde est là ? Démarre quand vous êtes prêts.')
      : 'L’hôte va démarrer la voiture…';
  }

  function rendreJeu(v) {
    afficher('jeu');
    const p = v.partie;
    // Avec une seule vie, on affiche le record de la salle à la place des cœurs.
    const uneVie = p.viesMax <= 1;
    $('jeu-vies').hidden = uneVie;
    $('jeu-record').hidden = !uneVie;
    $('jeu-record-score').textContent = v.record ? v.record.score : '–';
    if (!uneVie && $('jeu-vies').dataset.vies !== String(p.vies)) {
      $('jeu-vies').dataset.vies = p.vies;
      $('jeu-vies').innerHTML = Array.from({ length: p.viesMax }, (_, i) => COEUR(i < p.vies)).join('');
    }
    rendreVoiture(v.voiture || {});
    $('jeu-score').textContent = p.score;
    $('jeu-vitesse').textContent = p.vitesse;
    $('jeu-distance').textContent = formaterDistance(p.distance);
    const route = $('route');
    route.style.setProperty('--duree', (24 / p.vitesse).toFixed(2) + 's');
    route.classList.toggle('arret', p.accident > 0);

    // Accident en cours
    const accident = p.accident > 0;
    $('voile-accident').hidden = !accident;
    if (accident) {
      $('voile-texte').textContent = p.messageAccident;
      $('voile-suite').textContent = p.perdu ? 'La route s’arrête ici.' : 'On repart dans un instant…';
    }
    if (accident && !enAccident) {
      vibrer([200, 80, 200]);
      const ecran = $('ecran-jeu');
      ecran.classList.remove('secousse'); void ecran.offsetWidth; ecran.classList.add('secousse');
    }
    enAccident = accident;

    // Consigne
    const c = v.consigne;
    const bloc = $('consigne');
    if (c) {
      if (c.num !== numConsigne) {
        numConsigne = c.num;
        $('consigne-texte').textContent = c.texte;
        bloc.classList.remove('vide', 'nouvelle'); void bloc.offsetWidth; bloc.classList.add('nouvelle');
        vibrer(60);
      }
      echeance = performance.now() + c.restant;
      dureeConsigne = c.duree;
    } else if (numConsigne !== null || !bloc.classList.contains('vide')) {
      numConsigne = null;
      bloc.classList.add('vide');
      $('consigne-texte').textContent = p.joue ? 'Regarde la route…' : 'Tu regardes cette partie depuis le bord de la route.';
    }

    rendreCommandes(v.commandes);
  }

  let widgets = {};

  function rendreCommandes(commandes) {
    const zone = $('commandes');
    const signature = commandes.map((c) => c.id).join(',');
    if (signature !== signatureCommandes) {
      signatureCommandes = signature;
      widgets = {};
      zone.dataset.n = commandes.length;
      zone.replaceChildren(...commandes.map((c) => {
        const bloc = document.createElement('div');
        bloc.className = 'commande';
        bloc.dataset.commande = c.id;
        const titre = document.createElement('p');
        titre.className = 'commande-nom';
        titre.textContent = c.nom;
        const w = Widgets.creer(c, (valeur) => agir(c.id, valeur));
        widgets[c.id] = w;
        bloc.append(titre, w.el);
        return bloc;
      }));
    }
    for (const c of commandes) if (c.type === 'choix' && widgets[c.id]) widgets[c.id].maj(c.valeur);
  }

  // La voiture sur la route suit le volant, le clignotant, les phares et les warnings.
  const DECALAGE_VOLANT = { gauche_toute: [-30, -16], gauche: [-14, -7], droit: [0, 0], droite: [14, 7], droite_toute: [30, 16] };
  function rendreVoiture(etat) {
    const voiture = $('voiture');
    const [x, a] = DECALAGE_VOLANT[etat.volant] || [0, 0];
    voiture.style.transform = `translateX(${x}px) rotate(${a}deg)`;
    voiture.classList.toggle('cligno-gauche', etat.clignotant === 'gauche' || etat.warnings === 'on');
    voiture.classList.toggle('cligno-droite', etat.clignotant === 'droite' || etat.warnings === 'on');
    voiture.classList.toggle('codes', etat.phares === 'codes');
    voiture.classList.toggle('pleins', etat.phares === 'pleins');
  }

  const COEUR = (plein) => `<svg viewBox="0 0 24 22" width="24" height="22" aria-hidden="true"><path d="M12 21 C5 15 1 11.5 1 7 A5.5 5.5 0 0 1 12 4.5 A5.5 5.5 0 0 1 23 7 C23 11.5 19 15 12 21 Z" fill="${plein ? '#FF8672' : '#E8EBF8'}" stroke="#1226AA" stroke-width="1.6"/></svg>`;

  function agir(commande, valeur) {
    vibrer(15);
    appel(`/api/salles/${session.code}/action`, { joueur: session.joueur, commande, valeur })
      .catch((err) => toast(err.message, 'niveau'));
  }

  function rendreFin(v) {
    afficher('fin');
    signatureCommandes = '';
    numConsigne = null;
    enAccident = false;
    const p = v.partie;
    if (p) {
      $('fin-score').textContent = `${p.score} pts`;
      $('fin-distance').textContent = p.distance;
      $('fin-reussites').textContent = p.reussites;
      $('fin-niveau').textContent = p.niveau;
      $('fin-duree').textContent = formaterDuree(p.duree);
    }
    $('fin-cause').textContent = p && p.cause ? `Accident : ${p.cause}` : '';
    const record = p && p.record && v.essais > 1;
    $('fin-record').hidden = !(p && v.record);
    $('fin-record').textContent = record
      ? 'Nouveau record de l’équipage !'
      : (v.record ? `Record de l’équipage : ${v.record.score} pts · essai n° ${v.essais}` : '');
    $('fin-record').classList.toggle('nouveau', !!record);
    $('fin-message').textContent = 'N’importe qui peut relancer : dites-vous quand vous êtes prêts.';
  }

  // ---------- Événements, chrono, utilitaires ----------

  function traiterEvenements(evenements) {
    if (!evenements.length) return;
    const dernier = evenements[evenements.length - 1].num;
    // Au premier affichage, on ne rejoue pas l'historique.
    if (dernierEvenement === null) { dernierEvenement = dernier; return; }
    for (const e of evenements) {
      if (e.num <= dernierEvenement) continue;
      if (e.type === 'reussite') {
        toast(e.texte);
        const bloc = $('consigne');
        bloc.classList.remove('bravo'); void bloc.offsetWidth; bloc.classList.add('bravo');
      }
      else if (e.type === 'niveau' || e.type === 'depart') toast(e.texte, 'niveau');
    }
    dernierEvenement = dernier;
  }

  function animerChrono() {
    const barre = $('chrono-barre');
    if (numConsigne !== null && vue && vue.phase === 'jeu') {
      const reste = Math.max(0, echeance - performance.now());
      const part = Math.min(1, reste / dureeConsigne);
      barre.style.width = (part * 100).toFixed(1) + '%';
      barre.classList.toggle('urgent', part < 0.33);
    }
    requestAnimationFrame(animerChrono);
  }
  requestAnimationFrame(animerChrono);

  function toast(texte, classe) {
    const t = document.createElement('div');
    t.className = 'toast' + (classe ? ' ' + classe : '');
    t.textContent = texte;
    $('toasts').append(t);
    setTimeout(() => t.remove(), 2300);
  }

  function vibrer(motif) {
    if (navigator.vibrate) { try { navigator.vibrate(motif); } catch { /* rien */ } }
  }

  function formaterDistance(m) {
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(2).replace('.', ',')} km`;
  }

  function formaterDuree(s) {
    const min = Math.floor(s / 60);
    return min ? `${min} min ${String(s % 60).padStart(2, '0')}` : `${s} s`;
  }

  connecter();
})();
