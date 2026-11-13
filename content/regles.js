'use strict';

// Réglages du jeu. Les durées sont en millisecondes.
module.exports = {
  joueursMin: 2,
  joueursMax: 15,
  // Une seule vie : le premier accident arrête la route, et l'équipage
  // peut relancer autant qu'il veut (le record de la salle est gardé).
  vies: 1,

  // Commandes par joueur selon la taille de l'équipage.
  commandesParJoueur(nbJoueurs) {
    if (nbJoueurs <= 3) return 3;
    if (nbJoueurs <= 7) return 2;
    return 1;
  },

  // Le niveau monte toutes les N consignes réussies : la voiture accélère,
  // le chrono se resserre et les consignes s'enchaînent plus vite.
  reussitesParNiveau: 3,
  niveauMax: 15,

  // Temps laissé pour exécuter une consigne : 12 s au niveau 1, puis 10 %
  // de moins à chaque niveau (7,9 s au niveau 5, 4,6 s au niveau 10),
  // jamais moins de 3,5 s.
  dureeConsigne(niveau) {
    return Math.max(3500, Math.round(12000 * Math.pow(0.9, niveau - 1)));
  },

  // Nombre de consignes actives en même temps (au plus une par joueur).
  consignesSimultanees(niveau, nbJoueurs) {
    return Math.min(nbJoueurs, 1 + niveau);
  },

  // Points gagnés pour une consigne réussie.
  points(niveau) {
    return 10 + (niveau - 1) * 5;
  },

  // Vitesse affichée (km/h), utilisée aussi pour la distance parcourue.
  vitesse(niveau) {
    return 30 + niveau * 10;
  },

  // Pause [min, max] avant la consigne suivante sur un même téléphone :
  // 1 à 2,5 s au niveau 1, 0,15 à 0,7 s au niveau 10.
  pauseEntreConsignes(niveau) {
    const n = niveau - 1;
    return [Math.max(150, 1000 - n * 100), Math.max(400, 2500 - n * 200)];
  },
  // Durée de l'écran d'accident avant l'écran de fin.
  pauseAccident: 3500,
};
