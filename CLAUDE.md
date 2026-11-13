# CLAUDE.md : En voiture !

Jeu de coordination multijoueur du séminaire « Le permis de manager » (Sogea-Satom, décembre 2026), projet de Sacha Lopez (WORKLAB). Compagnon de l'appli PHP principale (`Sacha2point0/driversmanagers`, clone local `~/Sites/driversmanagers`, site `satom.worklab.fr`).

## Principe
2 à 15 joueurs = l'équipage d'une voiture, chacun sur son téléphone. Chacun a des commandes (1 à 3 selon la taille de l'équipage) ; les consignes apparaissent sur le téléphone d'un **autre** joueur, qui doit les crier. Consigne non exécutée à temps = accident (on ne nomme personne) ; 3 vies. Le niveau monte toutes les 5 réussites : la voiture accélère, le chrono se resserre (14 s à 5 s), plus de consignes simultanées.

## Choix techniques (validés avec Sacha le 13/11/2026)
- Node.js seul, **aucune dépendance npm**. Déployé comme application Node.js Hostinger synchronisée avec ce dépôt, sur un site distinct de l'appli PHP (sous-domaine prévu).
- Temps réel : Server-Sent Events (`/api/salles/{code}/flux`) pour pousser l'état, POST pour les actions. Choisi plutôt que WebSocket pour passer sans souci derrière le proxy Hostinger et se reconnecter seul sur un réseau instable.
- Le serveur fait foi (chrono, réussites, accidents). État en mémoire, perdu au redémarrage.
- Session par onglet (`sessionStorage`) : plusieurs onglets = plusieurs joueurs pour tester.
- Français uniquement, charte WORKLAB (texte bleu #1226AA, corail #FF8672, vert d'eau #3BD4AE, Nunito).
- Contenus modifiables dans `content/` (commandes et consignes, réglages).
- Graphismes (13/11/2026) : commandes dessinées en SVG dans `public/widgets.js` (pas d'images, pas d'emoji), 3 couleurs de la charte au plus ; la voiture sur la route suit volant, clignotant, phares et warnings (`vue.voiture`). Démonstration : `/atelier.html`. Les éléments SVG se déplacent par l'attribut `transform` animé en JS (les transitions CSS sur SVG se sont montrées peu fiables).

## Étapes
1. **V1 (13/11/2026)** : salles par code à 4 chiffres, sans lien avec les équipes du séminaire, pour tester le jeu.
2. À venir : rattachement aux équipes de l'appli PHP (bouton dans l'appli, jeton signé pour entrer dans la salle de son équipe sans se reconnecter), remontée des scores vers la plénière, écran animateur.

## Tests
```bash
npm start                                         # http://localhost:3000
node tools/simulation.js http://localhost:3000 6 0.9 40   # robots
```
