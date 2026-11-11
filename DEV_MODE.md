# Mode Développement - Guide d'Utilisation

## Démarrage rapide

```bash
npm run dev examples/sdml/01-simple-markdown.slidedeck
```

Le navigateur s'ouvre automatiquement sur `http://localhost:3000` avec :
- **Gauche** : Éditeur de code avec coloration syntaxique
- **Droite** : Prévisualisation en temps réel

## Commandes

```bash
# Lancer avec un fichier spécifique
npm run dev examples/sdml/complete-demo.slidedeck

# Utiliser un port personnalisé
npm run dev examples/sdml/01-simple-markdown.slidedeck -- --port 3001

# Ne pas ouvrir le navigateur automatiquement
npm run dev examples/sdml/01-simple-markdown.slidedeck -- --no-open

# Démarrer sans fichier (contenu par défaut)
npm run dev
```

## Fonctionnalités

### Compilation automatique
- Modifications détectées après 500ms d'inactivité
- Erreurs affichées directement dans la prévisualisation

### Navigation intelligente
Quand vous modifiez une slide (entre deux `===`), la prévisualisation affiche automatiquement cette slide.

### Coloration syntaxique
L'éditeur reconnaît :
- `===` - Séparateur de slides (rouge)
- `---` - Séparateur de template (cyan)
- `#`, `##`, `###` - Titres
- `-`, `*`, `+`, `1.` - Listes
- `>` - Citations
- `![](...)` - Média
- `**bold**`, `*italic*`, `__underline__`
- ` ``` ` - Blocs de code
- `:::` - Délimiteur de style
- `{...}` - Attributs

### Panneau redimensionnable
Glissez le séparateur central pour ajuster la taille des panneaux.

### Indicateur de statut
- 🟢 **Vert (Ready)** : Prêt
- 🟠 **Orange (Compiling)** : Compilation en cours
- 🔴 **Rouge (Error)** : Erreur de compilation

## Raccourcis

- **Ctrl+S** / **Cmd+S** : Sauvegarde le fichier .sdml (notification en haut à droite)
  - ⚠️ Fonctionne uniquement si vous avez lancé avec un fichier : `npm run dev fichier.sdml`
  - Sans fichier, affiche un message d'erreur

## Architecture technique

```
Client (Navigateur)
    ├─ Monaco Editor (éditeur)
    ├─ WebSocket (Socket.IO)
    └─ iframe (prévisualisation reveal.js)
         ↕ WebSocket
Server (Node.js)
    ├─ Express (HTTP + fichiers statiques)
    ├─ Socket.IO (communication temps réel)
    └─ CompilerService (Langium → HTML)
```

## Développement

Pour modifier l'interface :
1. Éditer `src/dev-server/public/index.html`, `styles.css`, ou `app.js`
2. Recharger la page (pas besoin de rebuild)

Pour modifier le serveur ou le compilateur :
1. Éditer les fichiers TypeScript
2. Rebuild : `npm run build`
3. Redémarrer le serveur
