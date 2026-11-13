'use strict';

/*
 * Les commandes de la voiture, dessinées en SVG.
 * Widgets.creer(commande, agir) renvoie { el, maj(valeur) }.
 *  - agir(valeur) envoie l'action au serveur (valeur null pour un bouton) ;
 *  - maj(valeur) remet le dessin dans la position connue du serveur.
 * Charte WORKLAB : bleu, corail, vert d'eau (et un bleu très clair pour les fonds).
 */
window.Widgets = (() => {
  const B = '#1226AA';
  const C = '#FF8672';
  const V = '#3BD4AE';
  const L = '#E8EBF8';

  const frag = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));
  const propre = (label) => label.replace(/[◀▶↖↗↑⟲⟳]/g, '').trim();
  const rad = (deg) => (deg * Math.PI) / 180;

  // Coordonnées d'un clic dans le repère du viewBox.
  // On passe par la matrice de l'écran : le dessin est centré dans la zone
  // (marges à gauche et à droite sur un écran large), un simple calcul
  // proportionnel sur la largeur de l'élément tombait à côté.
  function point(svg, e) {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  // Déplace un élément SVG (attribut transform) avec une petite animation.
  // Plus fiable que les transitions CSS sur les éléments SVG selon les navigateurs.
  function deplacer(el, x, y) {
    const depart = el._pos || [x, y];
    el._pos = [x, y];
    const t0 = performance.now();
    const pas = (t) => {
      if (el._pos[0] !== x || el._pos[1] !== y) return; // un autre déplacement a pris le relais
      const k = Math.min(1, (t - t0) / 260);
      const e = 1 - (1 - k) ** 3;
      el.setAttribute('transform', `translate(${depart[0] + (x - depart[0]) * e} ${depart[1] + (y - depart[1]) * e})`);
      if (k < 1) requestAnimationFrame(pas);
    };
    el.setAttribute('transform', `translate(${depart[0]} ${depart[1]})`);
    requestAnimationFrame(pas);
  }

  function appui(el) {
    el.classList.remove('appui');
    void el.offsetWidth;
    el.classList.add('appui');
  }

  // Rangée de pastilles cliquables (complément des dessins).
  function pastilles(c, choisir) {
    const g = frag('<div class="positions"></div>');
    for (const v of c.valeurs) {
      const b = frag(`<button type="button" class="position" data-valeur="${esc(v.id)}">${esc(v.label)}</button>`);
      b.addEventListener('click', () => choisir(v.id));
      g.append(b);
    }
    return {
      el: g,
      maj: (val) => g.querySelectorAll('.position').forEach((b) => b.classList.toggle('active', b.dataset.valeur === val)),
    };
  }

  // ---------- Volant : on le tourne au doigt, ou on touche une pastille ----------
  const ANGLES_VOLANT = { gauche_toute: -90, gauche: -35, droit: 0, droite: 35, droite_toute: 90 };

  function volant(c, choisir) {
    const box = frag(`<div class="w">
      <svg viewBox="0 0 200 150" class="w-svg w-glisse" aria-label="Volant">
        <g class="volant-rot">
          <circle cx="100" cy="82" r="60" fill="none" stroke="${B}" stroke-width="16"/>
          <path d="M79 90 L43 94 M121 90 L157 94 M100 108 L100 140" stroke="${B}" stroke-width="12" stroke-linecap="round"/>
          <circle cx="100" cy="88" r="23" fill="${B}"/>
          <circle cx="100" cy="88" r="9" fill="${V}"/>
          <rect x="92" y="12" width="16" height="20" rx="5" fill="${C}"/>
        </g>
      </svg></div>`);
    const svg = box.querySelector('svg');
    const rot = box.querySelector('.volant-rot');
    let courant = 'droit';
    let drag = null;

    const poser = (v) => {
      courant = v;
      rot.style.transform = `rotate(${ANGLES_VOLANT[v] || 0}deg)`;
    };
    const angle = (e) => {
      const p = point(svg, e);
      return (Math.atan2(p.x - 100, -(p.y - 82)) * 180) / Math.PI;
    };
    svg.addEventListener('pointerdown', (e) => {
      drag = { a0: angle(e), base: ANGLES_VOLANT[courant] || 0, a: null };
      svg.setPointerCapture(e.pointerId);
      rot.classList.add('sans-transition');
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      let d = angle(e) - drag.a0;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      if (drag.a === null && Math.abs(d) < 5) return;
      drag.a = Math.max(-110, Math.min(110, drag.base + d));
      rot.style.transform = `rotate(${drag.a}deg)`;
    });
    const lacher = () => {
      if (!drag) return;
      rot.classList.remove('sans-transition');
      const a = drag.a;
      drag = null;
      if (a === null) return poser(courant);
      let meilleur = courant;
      let ecart = Infinity;
      for (const [k, v] of Object.entries(ANGLES_VOLANT)) {
        if (Math.abs(v - a) < ecart) { ecart = Math.abs(v - a); meilleur = k; }
      }
      if (meilleur !== courant) choisir(meilleur);
      else poser(courant);
    };
    svg.addEventListener('pointerup', lacher);
    svg.addEventListener('pointercancel', lacher);

    const p = pastilles(c, choisir);
    p.el.classList.add('positions-volant');
    box.append(p.el);
    return { el: box, maj(v) { if (!drag) poser(v); p.maj(v); } };
  }

  // ---------- Clignotant : manette qui glisse, flèches qui clignotent ----------
  function clignotant(c, choisir) {
    const X = { gauche: 50, aucun: 100, droite: 150 };
    const box = frag(`<div class="w">
      <svg viewBox="0 0 200 116" class="w-svg w-clic" aria-label="Clignotant">
        <polygon class="fleche" data-cote="gauche" points="16,30 42,10 42,22 70,22 70,38 42,38 42,50" fill="#fff" stroke="${B}" stroke-width="4" stroke-linejoin="round"/>
        <polygon class="fleche" data-cote="droite" points="184,30 158,10 158,22 130,22 130,38 158,38 158,50" fill="#fff" stroke="${B}" stroke-width="4" stroke-linejoin="round"/>
        <rect x="28" y="66" width="144" height="22" rx="11" fill="${L}"/>
        ${[50, 100, 150].map((x) => `<circle cx="${x}" cy="77" r="4" fill="${B}" opacity=".35"/>`).join('')}
        <g class="curseur"><circle r="17" fill="${C}" stroke="${B}" stroke-width="4"/></g>
        ${c.valeurs.map((v) => `<text x="${X[v.id]}" y="110" class="w-texte" data-valeur="${esc(v.id)}">${esc(propre(v.label))}</text>`).join('')}
      </svg></div>`);
    const svg = box.querySelector('svg');
    const curseur = box.querySelector('.curseur');
    svg.addEventListener('click', (e) => {
      const { x } = point(svg, e);
      const v = Object.keys(X).reduce((a, k) => (Math.abs(X[k] - x) < Math.abs(X[a] - x) ? k : a), 'aucun');
      choisir(v);
    });
    return {
      el: box,
      maj(v) {
        deplacer(curseur, X[v] ?? 100, 77);
        box.querySelectorAll('.fleche').forEach((f) => f.classList.toggle('allume', f.dataset.cote === v));
        box.querySelectorAll('.w-texte').forEach((t) => t.classList.toggle('actif', t.dataset.valeur === v));
      },
    };
  }

  // ---------- Boîte de vitesses : grille en H ----------
  function vitesses(c, choisir) {
    const P = { 1: [50, 26], 3: [100, 26], 5: [150, 26], N: [100, 74], 2: [50, 122], 4: [100, 122], R: [150, 122] };
    const box = frag(`<div class="w">
      <svg viewBox="0 0 200 148" class="w-svg" aria-label="Boîte de vitesses">
        <path d="M50 26 V122 M100 26 V122 M150 26 V122 M50 74 H150" stroke="${L}" stroke-width="22" stroke-linecap="round" fill="none"/>
        <path d="M50 26 V122 M100 26 V122 M150 26 V122 M50 74 H150" stroke="${B}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".35"/>
        ${Object.entries(P).map(([id, [x, y]]) => `
          <g class="rapport" data-valeur="${id}">
            <circle cx="${x}" cy="${y}" r="24" fill="transparent"/>
            <circle cx="${x}" cy="${y}" r="15" fill="#fff" stroke="${B}" stroke-width="3"/>
            <text x="${x}" y="${y + 5}" class="w-texte">${id}</text>
          </g>`).join('')}
        <g class="pommeau"><circle r="20" fill="${C}" stroke="${B}" stroke-width="4"/><text y="6" class="w-texte pommeau-texte"></text></g>
      </svg></div>`);
    const pommeau = box.querySelector('.pommeau');
    box.querySelectorAll('.rapport').forEach((g) => g.addEventListener('click', () => choisir(g.dataset.valeur)));
    return {
      el: box,
      maj(v) {
        const [x, y] = P[v] || P.N;
        deplacer(pommeau, x, y);
        pommeau.querySelector('text').textContent = v;
      },
    };
  }

  // ---------- Pédales et klaxon (actions ponctuelles) ----------
  function pedale(c, agir) {
    const large = c.id === 'frein';
    const forme = large
      ? `<rect x="36" y="18" width="128" height="74" rx="18" fill="${B}"/>
         ${[36, 55, 74].map((y) => `<line x1="56" y1="${y}" x2="144" y2="${y}" stroke="${L}" stroke-width="6" stroke-linecap="round" opacity=".6"/>`).join('')}`
      : `<rect x="70" y="6" width="60" height="100" rx="16" fill="${B}"/>
         ${[26, 44, 62, 80].map((y) => `<line x1="86" y1="${y}" x2="114" y2="${y}" stroke="${L}" stroke-width="6" stroke-linecap="round" opacity=".6"/>`).join('')}`;
    const box = frag(`<button type="button" class="w w-bouton">
      <svg viewBox="0 0 200 112" class="w-svg"><g class="enfoncable">${forme}</g></svg>
      <span class="w-label">${esc(c.bouton)}</span></button>`);
    box.addEventListener('click', () => { appui(box); agir(null); });
    return { el: box, maj() {} };
  }

  function klaxon(c, agir) {
    const box = frag(`<button type="button" class="w w-bouton">
      <svg viewBox="0 0 200 112" class="w-svg">
        <g class="enfoncable">
          <circle cx="100" cy="56" r="48" fill="${B}"/>
          <path d="M74 46 H86 L110 30 V82 L86 66 H74 Z" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
        </g>
        <path class="onde" d="M120 42 Q128 56 120 70" stroke="${V}" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path class="onde onde-2" d="M134 32 Q148 56 134 80" stroke="${V}" stroke-width="6" fill="none" stroke-linecap="round"/>
      </svg>
      <span class="w-label">${esc(c.bouton)}</span></button>`);
    box.addEventListener('click', () => { appui(box); agir(null); });
    return { el: box, maj() {} };
  }

  // ---------- Molette rotative (phares, essuie-glaces, climatisation) ----------
  function molette(c, choisir) {
    const n = c.valeurs.length;
    const angles = c.valeurs.map((_, i) => (n === 1 ? 0 : -65 + (i * 130) / (n - 1)));
    const cx = 130;
    const cy = 98;
    const pos = (a, r) => [cx + r * Math.sin(rad(a)), cy - r * Math.cos(rad(a))];
    const reperes = c.valeurs.map((v, i) => {
      const [x, y] = pos(angles[i], 80);
      const [px, py] = pos(angles[i], 46);
      const texte = propre(v.label);
      const larg = texte.length * 7.2 + 16;
      return `<g class="repere" data-valeur="${esc(v.id)}">
        <rect x="${x - larg / 2}" y="${y - 13}" width="${larg}" height="24" rx="12" class="repere-fond"/>
        <text x="${x}" y="${y + 4}" class="w-texte">${esc(texte)}</text>
        <circle cx="${px}" cy="${py}" r="4" fill="${B}" opacity=".35"/>
      </g>`;
    }).join('');
    const box = frag(`<div class="w">
      <svg viewBox="0 0 260 140" class="w-svg" aria-label="${esc(c.nom)}">
        ${reperes}
        <g class="bouton-molette">
          <circle cx="${cx}" cy="${cy}" r="36" fill="#fff" stroke="${B}" stroke-width="6"/>
          <circle cx="${cx}" cy="${cy}" r="25" fill="${L}"/>
          <g class="aiguille"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 29}" stroke="${C}" stroke-width="8" stroke-linecap="round"/></g>
          <circle cx="${cx}" cy="${cy}" r="7" fill="${B}"/>
        </g>
      </svg></div>`);
    let courant = c.valeurs[0].id;
    const aiguille = box.querySelector('.aiguille');
    aiguille.style.transformOrigin = `${cx}px ${cy}px`;
    box.querySelectorAll('.repere').forEach((g) => g.addEventListener('click', () => choisir(g.dataset.valeur)));
    box.querySelector('.bouton-molette').addEventListener('click', () => {
      const i = c.valeurs.findIndex((v) => v.id === courant);
      choisir(c.valeurs[(i + 1) % n].id);
    });
    return {
      el: box,
      maj(v) {
        courant = v;
        const i = Math.max(0, c.valeurs.findIndex((x) => x.id === v));
        aiguille.style.transform = `rotate(${angles[i]}deg)`;
        box.querySelectorAll('.repere').forEach((g) => g.classList.toggle('actif', g.dataset.valeur === v));
      },
    };
  }

  // ---------- Deux positions : warnings, antibrouillards, frein à main ----------
  function bascule(c, choisir, dessin) {
    const [a, b] = c.valeurs;
    const box = frag(`<button type="button" class="w w-bouton">
      <svg viewBox="0 0 200 112" class="w-svg">${dessin}</svg>
      <span class="w-label w-etat"></span></button>`);
    let courant = a.id;
    box.addEventListener('click', () => choisir(courant === a.id ? b.id : a.id));
    return {
      el: box,
      maj(v) {
        courant = v;
        box.classList.toggle('on', v === b.id);
        box.querySelector('.w-etat').textContent = propre((v === b.id ? b : a).label);
      },
    };
  }

  const warnings = (c, choisir) => bascule(c, choisir, `
    <polygon class="triangle" points="100,10 166,104 34,104" stroke="${B}" stroke-width="10" stroke-linejoin="round"/>
    <polygon points="100,42 136,92 64,92" fill="none" stroke="${B}" stroke-width="7" stroke-linejoin="round"/>`);

  const antibrouillard = (c, choisir) => bascule(c, choisir, `
    <g transform="translate(24 30)" stroke="${B}" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M30 6 A22 22 0 0 0 30 50 Z" fill="#fff"/>
      <path d="M2 14 H18 M2 28 H18 M2 42 H18"/>
      <path d="M42 8 V48" stroke-dasharray="4 6"/>
    </g>
    <rect x="96" y="32" width="84" height="46" rx="23" class="interrupteur-fond"/>
    <circle class="interrupteur-plot" cx="119" cy="55" r="18" fill="#fff" stroke="${B}" stroke-width="4"/>`);

  const freinMain = (c, choisir) => bascule(c, choisir, `
    <rect x="22" y="88" width="156" height="14" rx="7" fill="${L}"/>
    <g class="levier">
      <rect x="36" y="74" width="132" height="20" rx="10" fill="${B}"/>
      <rect x="128" y="70" width="44" height="28" rx="12" fill="${C}" stroke="${B}" stroke-width="4"/>
      <circle cx="46" cy="84" r="12" fill="#fff" stroke="${B}" stroke-width="4"/>
    </g>`);

  // ---------- Écrans à touches : autoradio, GPS ----------
  function ecran(c, choisir) {
    const box = frag(`<div class="w w-ecran">
      <div class="ecran-afficheur"><span class="ecran-petit">${c.id === 'gps' ? 'Itinéraire' : 'FM 98.4'}</span><strong class="ecran-valeur"></strong></div>
    </div>`);
    const p = pastilles(c, choisir);
    box.append(p.el);
    return {
      el: box,
      maj(v) {
        const val = c.valeurs.find((x) => x.id === v);
        box.querySelector('.ecran-valeur').textContent = val ? propre(val.label) : '';
        p.maj(v);
      },
    };
  }

  // ---------- Vitres : la vitre monte et descend ----------
  function vitres(c, choisir) {
    const H = { fermees: 0, mi: 40, ouvertes: 76 };
    const box = frag(`<div class="w">
      <svg viewBox="0 0 200 132" class="w-svg" aria-label="Vitres">
        <defs><clipPath id="clip-vitre"><path d="M34 98 V52 Q34 18 74 18 H166 V98 Z"/></clipPath></defs>
        <rect x="20" y="98" width="160" height="30" rx="8" fill="${L}"/>
        <g clip-path="url(#clip-vitre)"><rect class="vitre" x="30" y="14" width="140" height="86" fill="${V}" opacity=".7"/></g>
        <path d="M34 98 V52 Q34 18 74 18 H166 V98" fill="none" stroke="${B}" stroke-width="7" stroke-linejoin="round"/>
        <line x1="20" y1="98" x2="180" y2="98" stroke="${B}" stroke-width="7" stroke-linecap="round"/>
      </svg></div>`);
    const vitre = box.querySelector('.vitre');
    const p = pastilles(c, choisir);
    box.append(p.el);
    return { el: box, maj(v) { vitre.style.transform = `translateY(${H[v] ?? 0}px)`; p.maj(v); } };
  }

  // ---------- Repli : boutons simples ----------
  function choixGenerique(c, choisir) {
    const p = pastilles(c, choisir);
    return { el: p.el, maj: p.maj };
  }
  function boutonGenerique(c, agir) {
    const b = frag(`<button type="button" class="action">${esc(c.bouton)}</button>`);
    b.addEventListener('click', () => { appui(b); agir(null); });
    return { el: b, maj() {} };
  }

  const FABRIQUES = {
    volant, clignotant, vitesses, vitres,
    frein: pedale, accelerateur: pedale, klaxon,
    phares: molette, essuie: molette, clim: molette,
    warnings, antibrouillard, frein_main: freinMain,
    autoradio: ecran, gps: ecran,
  };

  function creer(c, agir) {
    const fabrique = FABRIQUES[c.id] || (c.type === 'bouton' ? boutonGenerique : choixGenerique);
    let local = 0;
    let w = null;
    // Mise à jour immédiate à l'écran, puis envoi au serveur.
    const choisir = (val) => { local = Date.now(); w.maj(val); agir(val); };
    w = c.type === 'bouton' ? fabrique(c, agir) : fabrique(c, choisir);
    w.maj(c.valeur);
    return {
      el: w.el,
      // On ignore brièvement l'état du serveur juste après une action locale,
      // le temps que l'action lui parvienne (évite un retour en arrière visuel).
      maj(val) { if (Date.now() - local > 800) w.maj(val); },
    };
  }

  return { creer };
})();
