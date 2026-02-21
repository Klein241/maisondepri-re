# Live Proxy Server — Maison de Prière

## Qu'est-ce que c'est ?
Un micro-service qui **intercepte les flux live** depuis les plateformes bloquées (Facebook, YouTube, TikTok...)
et les redistribue via une URL propre (`fly.dev`) accessible **sans VPN**.

## Comment ça marche
```
📱 Admin lance un live sur Facebook (téléphone)
      ↓
📋 Admin colle le lien du live dans l'admin de l'app
      ↓
🔧 Ce serveur (sur Fly.io à Paris) :
   1. yt-dlp extrait le vrai stream URL depuis Facebook
   2. FFmpeg convertit en HLS basse latence
   3. WebSocket gère commentaires/réactions en temps réel
      ↓
👤 Utilisateurs regardent depuis maisondepriere-live.fly.dev
   (PAS bloqué, car ce n'est PAS Facebook)
```

## Déploiement sur Fly.io (gratuit)

```bash
# 1. Installer flyctl
curl -L https://fly.io/install.sh | sh

# 2. Créer un compte (pas de carte bancaire)
flyctl auth signup

# 3. Se connecter
flyctl auth login

# 4. Depuis ce dossier
cd live-proxy-server

# 5. Lancer
flyctl launch --name maisondepriere-live --region cdg --no-deploy

# 6. Ajouter la clé admin (choisir un mot de passe fort)
flyctl secrets set ADMIN_KEY=votre_cle_admin_secrete

# 7. Créer le volume pour les streams
flyctl volumes create live_data --region cdg --size 1

# 8. Déployer !
flyctl deploy

# 9. Tester
curl https://maisondepriere-live.fly.dev/health
```

## API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Statut du serveur |
| GET | `/api/status` | Statut du live en cours |
| POST | `/api/start-proxy` | Démarrer le proxy (admin) |
| POST | `/api/stop-proxy` | Arrêter le proxy (admin) |
| GET | `/api/replays` | Liste des replays enregistrés |
| GET | `/streams/live/playlist.m3u8` | Flux HLS (pour hls.js) |

## Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `ADMIN_KEY` | Clé d'authentification admin | `maison-de-priere-admin-2026` |
| `PORT` | Port du serveur | `3000` |
| `FLY_APP_NAME` | Nom de l'app Fly.io (auto) | - |
