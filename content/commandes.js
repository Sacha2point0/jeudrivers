'use strict';

/*
 * Les commandes de la voiture.
 *
 * L'ordre compte : avec peu de joueurs, on ne distribue que les premières
 * commandes de la liste (il y en a 15 au total, une par joueur au maximum).
 *
 * Deux types :
 *  - « choix »  : plusieurs positions, une seule active (ex. clignotant).
 *                 Chaque position porte la consigne qui demande de la choisir.
 *                 `initial` est la position au départ de la partie.
 *  - « bouton » : une action ponctuelle (ex. klaxon). `consignes` liste les
 *                 formulations possibles, tirées au hasard.
 */
module.exports = [
  {
    id: 'volant', nom: 'Volant', icone: '🛞', type: 'choix', initial: 'droit',
    valeurs: [
      { id: 'gauche_toute', label: '⟲ À fond', consigne: 'Braque à fond à gauche !' },
      { id: 'gauche', label: '↖ Un peu', consigne: 'Tourne un peu à gauche !' },
      { id: 'droit', label: '↑ Droit', consigne: 'Remets les roues droites !' },
      { id: 'droite', label: 'Un peu ↗', consigne: 'Tourne un peu à droite !' },
      { id: 'droite_toute', label: 'À fond ⟳', consigne: 'Braque à fond à droite !' },
    ],
  },
  {
    id: 'clignotant', nom: 'Clignotant', icone: '↔️', type: 'choix', initial: 'aucun',
    valeurs: [
      { id: 'gauche', label: '◀ Gauche', consigne: 'Clignotant à gauche !' },
      { id: 'aucun', label: 'Arrêt', consigne: 'Coupe le clignotant !' },
      { id: 'droite', label: 'Droite ▶', consigne: 'Clignotant à droite !' },
    ],
  },
  {
    id: 'frein', nom: 'Frein', icone: '🛑', type: 'bouton', bouton: 'Freiner',
    consignes: ['Freine !', 'Pile ! Freine !', 'Ralentis, freine !'],
  },
  {
    id: 'vitesses', nom: 'Boîte de vitesses', icone: '⚙️', type: 'choix', initial: '1',
    valeurs: [
      { id: 'R', label: 'R', consigne: 'Passe la marche arrière !' },
      { id: 'N', label: 'N', consigne: 'Mets au point mort !' },
      { id: '1', label: '1', consigne: 'Passe la première !' },
      { id: '2', label: '2', consigne: 'Passe la deuxième !' },
      { id: '3', label: '3', consigne: 'Passe la troisième !' },
      { id: '4', label: '4', consigne: 'Passe la quatrième !' },
      { id: '5', label: '5', consigne: 'Passe la cinquième !' },
    ],
  },
  {
    id: 'accelerateur', nom: 'Accélérateur', icone: '⚡', type: 'bouton', bouton: 'Accélérer',
    consignes: ['Accélère !', 'Plein gaz !', 'Remets les gaz !'],
  },
  {
    id: 'klaxon', nom: 'Klaxon', icone: '📯', type: 'bouton', bouton: 'Klaxonner',
    consignes: ['Klaxonne !', 'Un coup de klaxon !', 'Préviens-le, klaxonne !'],
  },
  {
    id: 'phares', nom: 'Phares', icone: '💡', type: 'choix', initial: 'eteints',
    valeurs: [
      { id: 'eteints', label: 'Éteints', consigne: 'Éteins les phares !' },
      { id: 'codes', label: 'Codes', consigne: 'Allume les codes !' },
      { id: 'pleins', label: 'Pleins phares', consigne: 'Pleins phares !' },
    ],
  },
  {
    id: 'essuie', nom: 'Essuie-glaces', icone: '🌧️', type: 'choix', initial: 'arret',
    valeurs: [
      { id: 'arret', label: 'Arrêt', consigne: 'Coupe les essuie-glaces !' },
      { id: 'lent', label: 'Lent', consigne: 'Essuie-glaces en lent !' },
      { id: 'rapide', label: 'Rapide', consigne: 'Essuie-glaces à fond !' },
    ],
  },
  {
    id: 'warnings', nom: 'Warnings', icone: '⚠️', type: 'choix', initial: 'off',
    valeurs: [
      { id: 'off', label: 'Éteints', consigne: 'Coupe les warnings !' },
      { id: 'on', label: 'Allumés', consigne: 'Allume les warnings !' },
    ],
  },
  {
    id: 'autoradio', nom: 'Autoradio', icone: '📻', type: 'choix', initial: 'musique',
    valeurs: [
      { id: 'silence', label: 'Silence', consigne: 'Coupe la radio !' },
      { id: 'musique', label: 'Musique', consigne: 'Remets de la musique !' },
      { id: 'infos', label: 'Infos trafic', consigne: 'Mets les infos trafic !' },
      { id: 'meteo', label: 'Météo', consigne: 'Mets la météo à la radio !' },
    ],
  },
  {
    id: 'frein_main', nom: 'Frein à main', icone: '🅿️', type: 'choix', initial: 'desserre',
    valeurs: [
      { id: 'desserre', label: 'Desserré', consigne: 'Desserre le frein à main !' },
      { id: 'serre', label: 'Serré', consigne: 'Serre le frein à main !' },
    ],
  },
  {
    id: 'vitres', nom: 'Vitres', icone: '🪟', type: 'choix', initial: 'fermees',
    valeurs: [
      { id: 'fermees', label: 'Fermées', consigne: 'Remonte les vitres !' },
      { id: 'mi', label: 'À moitié', consigne: 'Ouvre les vitres à moitié !' },
      { id: 'ouvertes', label: 'Ouvertes', consigne: 'Baisse les vitres en grand !' },
    ],
  },
  {
    id: 'clim', nom: 'Climatisation', icone: '❄️', type: 'choix', initial: 'arret',
    valeurs: [
      { id: 'arret', label: 'Arrêt', consigne: 'Coupe la clim !' },
      { id: 'froid', label: 'Froid', consigne: 'Mets la clim à fond !' },
      { id: 'chaud', label: 'Chauffage', consigne: 'Mets le chauffage !' },
    ],
  },
  {
    id: 'antibrouillard', nom: 'Antibrouillards', icone: '🌫️', type: 'choix', initial: 'off',
    valeurs: [
      { id: 'off', label: 'Éteints', consigne: 'Coupe les antibrouillards !' },
      { id: 'on', label: 'Allumés', consigne: 'Allume les antibrouillards !' },
    ],
  },
  {
    id: 'gps', nom: 'GPS', icone: '🧭', type: 'choix', initial: 'rapide',
    valeurs: [
      { id: 'rapide', label: 'Plus rapide', consigne: 'GPS : itinéraire le plus rapide !' },
      { id: 'peages', label: 'Sans péage', consigne: 'GPS : évite les péages !' },
      { id: 'station', label: 'Station', consigne: 'GPS : trouve une station-service !' },
      { id: 'chantier', label: 'Chantier', consigne: 'GPS : direction le chantier !' },
    ],
  },
];
