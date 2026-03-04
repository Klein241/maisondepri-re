# ☁️ Guide de déploiement — Cloudflare Worker

## Prérequis

1. Un compte Cloudflare (gratuit) → https://dash.cloudflare.com/sign-up
2. Node.js installé en local

## 1. Installation

```bash
cd cloudflare-worker
npm install
```

## 2. Créer le KV Namespace

```bash
npx wrangler kv namespace create PUSH_KV
```

Copiez l'ID retourné et collez-le dans `wrangler.toml` :
```toml
[[kv_namespaces]]
binding = "PUSH_KV"
id = "VOTRE_ID_ICI"
```

## 3. Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

Ou utilisez vos clés VAPID existantes si vous en aviez déjà.

## 4. Configurer les secrets

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
# Collez votre clé publique VAPID

npx wrangler secret put VAPID_PRIVATE_KEY
# Collez votre clé privée VAPID

npx wrangler secret put ADMIN_KEY
# Choisissez un mot de passe admin
```

## 5. Déployer

```bash
npm run deploy
```

Vous obtiendrez une URL comme :
```
https://maisondepriere-api.VOTRE-COMPTE.workers.dev
```

## 6. Configurer l'application

1. Ouvrez votre app → **Admin** → **Live & Réseaux Sociaux**
2. Dans la section **☁️ Cloudflare Worker**, collez l'URL du Worker
3. Cliquez **Vérifier statut** pour confirmer la connexion
4. Sauvegardez

## 7. (Optionnel) Webhook Supabase pour auto-push

Pour envoyer automatiquement une notification push quand une notification est créée dans Supabase :

1. Allez dans **Supabase Dashboard** → **Database** → **Webhooks**
2. Créez un webhook :
   - **Table** : `notifications`
   - **Event** : `INSERT`
   - **URL** : `https://maisondepriere-api.VOTRE-COMPTE.workers.dev/api/webhook/notification`
   - **Method** : `POST`

## Limites du plan gratuit

| Ressource | Limite gratuite |
|-----------|----------------|
| Requêtes Worker | 100 000/jour |
| KV lectures | 100 000/jour |
| KV écritures | 1 000/jour |
| Taille du Worker | 1 MB |

## Endpoints disponibles

| Route | Méthode | Description |
|-------|---------|-------------|
| `/health` | GET | Vérifie le statut du Worker |
| `/api/push/vapid-key` | GET | Récupère la clé VAPID publique |
| `/api/push/register` | POST | Enregistre une souscription push |
| `/api/push/unregister` | POST | Supprime une souscription |
| `/api/push/send` | POST | Envoie un push à un utilisateur (admin) |
| `/api/push/broadcast` | POST | Envoie un push à tous (admin) |
| `/api/webhook/notification` | POST | Webhook Supabase |
| `/api/link-preview` | POST | Aperçu d'un lien (OG tags) |
| `/api/analytics` | GET | Statistiques |


## Configuration `.env.local`

Ajoutez dans votre `.env.local` :
```
NEXT_PUBLIC_WORKER_URL=https://maisondepriere-api.VOTRE-COMPTE.workers.dev
```
