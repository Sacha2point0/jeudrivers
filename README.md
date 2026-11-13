# En voiture !

Jeu de coordination en équipe sur téléphone, pour le séminaire « Le permis de manager » (Sogea-Satom, décembre 2026, WORKLAB).

De 2 à 15 joueurs forment l'équipage d'une même voiture. Chacun a sur son téléphone des commandes que lui seul peut actionner (volant, clignotant, frein, boîte de vitesses, autoradio…). Les consignes s'affichent sur le téléphone **d'un autre** joueur, qui doit les crier à l'équipage. Une consigne non exécutée à temps provoque un accident ; le premier accident arrête la route, et l'équipage relance autant qu'il veut pour battre son record. Plus l'équipe réussit, plus la voiture accélère et plus le chrono se resserre.

## Lancer en local

```bash
npm start
```

Puis ouvrir http://localhost:3000. Pour tester à plusieurs sur un même ordinateur, ouvrir plusieurs onglets (chaque onglet est un joueur). Pour tester avec des téléphones sur le même wifi, ouvrir `http://<adresse IP du Mac>:3000`.

Simulation avec des joueurs robots (le serveur doit tourner) :

```bash
node tools/simulation.js http://localhost:3000 6 0.9 40
```

(adresse, nombre de joueurs, taux de réussite, durée en secondes). On peut rejoindre la salle affichée pour regarder.

## Déploiement Hostinger (application Node.js)

- Dépôt synchronisé : `Sacha2point0/jeudrivers`, branche `main`.
- Fichier d'entrée : `server.js` ; commande de démarrage : `npm start`.
- Node.js 18 ou plus. Aucune dépendance (`npm install` ne télécharge rien).
- Le port est fourni par Hostinger via la variable `PORT` (3000 par défaut).
- Vérification : `https://<domaine>/sante` doit répondre `{"ok":true,...}`.

Les parties sont gardées en mémoire : un redémarrage du serveur (redéploiement) les efface. Ne pas redéployer pendant une session de jeu.

## Organisation du code

- `server.js` : serveur HTTP, fichiers statiques, API, horloge du jeu.
- `src/salle.js` : une salle = un équipage ; règles, consignes, accidents, ce que voit chaque joueur.
- `content/commandes.js` : les 15 commandes de la voiture et leurs consignes (textes modifiables).
- `content/regles.js` : vies, chrono, accélération, points.
- `public/` : l'interface téléphone (HTML, CSS, JS sans framework).
- `public/widgets.js` : les 15 commandes dessinées en SVG (volant à tourner au doigt, grille de vitesses en H, pédales, molettes…).
- `public/atelier.html` : page de démonstration de toutes les commandes, hors partie (`/atelier.html`).
- `tools/simulation.js` : équipage de robots pour les tests.
