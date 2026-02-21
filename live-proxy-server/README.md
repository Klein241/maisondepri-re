# 🚀 Maison de Prière — Multi-Service Proxy Server

Serveur proxy Fly.io pour contourner les restrictions VPN et fournir des services temps réel.

## 📺 Services disponibles

| # | Service | Endpoint | Description |
|---|---------|----------|-------------|
| 1 | **Live Proxy** | `POST /api/start-proxy` | Stream live Facebook/YouTube via HLS |
| 2 | **Video Gallery** | `POST /api/videos/list` | Liste toutes les vidéos d'une page Facebook |
| 3 | **Video Extract** | `POST /api/videos/extract` | Extrait l'URL directe d'une vidéo |
| 4 | **Video Stream** | `GET /api/videos/stream?url=` | Proxy HTTP pour vidéos bloquées |
| 5 | **Push Register** | `POST /api/push/register` | Enregistre un abonnement push |
| 6 | **Push Broadcast** | `POST /api/push/broadcast` | Envoie une notification à tous |
| 7 | **Link Preview** | `POST /api/link-preview` | Aperçu OpenGraph d'un lien |
| 8 | **Image Compress** | `POST /api/compress-image` | Compression d'image via Sharp |
| 9 | **Analytics** | `GET /api/analytics` | Stats en temps réel |
| 10 | **WebSocket** | `socket.io` | Presence, typing, reactions, comments |

## 🔧 Déploiement sur Fly.io

```bash
# 1. Installer flyctl
curl -L https://fly.io/install.sh | sh

# 2. Se connecter
flyctl auth login

# 3. Créer l'app
cd live-proxy-server
flyctl apps create maisondepriere-live

# 4. Configurer les secrets
flyctl secrets set ADMIN_KEY="maison-de-priere-admin-2026"
flyctl secrets set SUPABASE_URL="https://votre-projet.supabase.co"
flyctl secrets set SUPABASE_SERVICE_KEY="eyJ..."

# 5. Générer les clés VAPID (pour les notifications push)
npx web-push generate-vapid-keys
# Puis configurer:
flyctl secrets set VAPID_PUBLIC_KEY="BN..."
flyctl secrets set VAPID_PRIVATE_KEY="xx..."
flyctl secrets set VAPID_EMAIL="mailto:admin@maisondepriere.app"

# 6. Créer le volume pour le stockage
flyctl volumes create live_data --region cdg --size 1

# 7. Déployer
flyctl deploy
```

## 📡 WebSocket Events

### Client → Server
| Event | Data | Description |
|-------|------|-------------|
| `user_online` | `{ userId, name, avatar }` | Marquer l'utilisateur en ligne |
| `typing_start` | `{ roomId, userId, userName }` | Commencé à taper |
| `typing_stop` | `{ roomId, userId, userName }` | Arrêté de taper |
| `reaction` | `{ emoji, userId, userName }` | Envoyer une réaction live |
| `comment` | `{ text, userName, userId, parentId }` | Envoyer un commentaire live |

### Server → Client
| Event | Data | Description |
|-------|------|-------------|
| `connection_ready` | `{ status, viewers, online_users, ... }` | État initial |
| `presence_update` | `{ type, userId, name, online_users }` | Changement de présence |
| `user_typing` | `{ roomId, userId, userName, isTyping }` | Indicateur de frappe |
| `new_reaction` | `{ emoji, userId, count }` | Nouvelle réaction |
| `new_comment` | `{ id, text, userName, timestamp }` | Nouveau commentaire |
| `viewer_count` | `number` | Nombre de viewers |
| `proxy_status` | `{ status, stream_url? }` | État du proxy live |
| `live_started` | `{ stream_url, live_id }` | Live démarré |
| `live_ended` | `{ timestamp }` | Live terminé |

## 💰 Coût : GRATUIT

Fly.io offre :
- 3 VMs gratuites à vie
- 160GB de bande passante/mois
- 3GB de stockage persistant
- Pas de carte bancaire requise
