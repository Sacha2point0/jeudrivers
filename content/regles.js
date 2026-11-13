'use strict';

// Réglages du jeu. Les durées sont en millisecondes.
module.exports = {
  joueursMin: 2,
  joueursMax: 15,
  vies: 3,

  // Commandes par joueur selon la taille de l'équipage.
  commandesParJoueur(nbJoueurs) {
    if (nbJoueurs <= 3) return 3;
    if (nbJoueurs <= 7) return 2;
    return 1;
  },

  // Le niveau monte toutes les N consignes réussies.
  reussitesParNiveau: 5,
  niveauMax: 10,

  // Temps laissé pour exécuter une consigne : de 14 s (niveau 1) à 5 s.
  dureeConsigne(niveau) {
    return Math.max(5000, 14000 - (niveau - 1) * 1000);
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

  // Pause entre deux consignes d'un même joueur, et après un accident.
  pauseEntreConsignes: [1000, 2500],
  pauseAccident: 3500,
};
