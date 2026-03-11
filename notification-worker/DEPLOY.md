# 🔔 Notification Worker — Guide de Déploiement

## Architecture

```
[React Native / Web App]
       ↕ REST (Worker URL)
[Cloudflare Worker — Notification Gateway]
       ↕                    ↕
[Cloudflare Queue]    [Cloudflare KV ×4]
(batch push async)    (cache + compteurs)
       ↕
[Supabase — source de vérité]
```

## ── Prérequis ──────────────────────────────────────

1. **Node.js 18+** installé
2. **Compte Cloudflare** avec Workers activé (free tier OK)
3. **Wrangler CLI** installé : `npm install -g wrangler`
4. Authentifié : `wrangler login`

## ── Étape 1: Installer les dépendances ─────────────

```bash
cd notification-worker
npm install
```

## ── Étape 2: Créer les KV Namespaces ───────────────

```bash
# Exécuter chaque commande et noter l'ID retourné
npx wrangler kv namespace create "NOTIFICATION_CACHE"
npx wrangler kv namespace create "PUSH_TOKEN_CACHE"
npx wrangler kv namespace create "UNREAD_COUNTERS"
npx wrangler kv namespace create "USER_PREFERENCES"
```

Copier les IDs retournés dans `wrangler.toml` :
```toml
[[kv_namespaces]]
binding = "NOTIFICATION_CACHE"
id = "<copier_l_id_ici>"

[[kv_namespaces]]
binding = "PUSH_TOKEN_CACHE"
id = "<copier_l_id_ici>"

# etc.
```

## ── Étape 3: Créer la Queue ────────────────────────

```bash
npx wrangler queues create notification-push-queue
npx wrangler queues create notification-dlq  # Dead letter queue
```

## ── Étape 4: Configurer les Secrets ────────────────

```bash
# URL Supabase (sans le / final)
npx wrangler secret put SUPABASE_URL
# → Entrer: https://votreprojet.supabase.co

# Clé service role Supabase (pas l'anon key !)
npx wrangler secret put SUPABASE_SERVICE_KEY
# → Entrer la clé depuis Dashboard Supabase > Settings > API > service_role

# Clés VAPID (les mêmes que votre worker existant)
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

## ── Étape 5: Exécuter la Migration SQL ─────────────

1. Ouvrir le **Supabase Dashboard** → SQL Editor
2. Copier-coller le contenu de `supabase-migrations/notification_v2.sql`
3. Exécuter
4. Vérifier que les tables sont créées :
   - `notification_preferences`
   - `push_tokens`
   - `prayer_comments`
   - Nouvelles colonnes sur `notifications` (actors, aggregation_key, priority, etc.)

## ── Étape 6: Déployer le Worker ────────────────────

```bash
cd notification-worker
npx wrangler deploy
```

Le worker sera disponible à :
```
https://maisondepriere-notifications.<votre-subdomain>.workers.dev
```

## ── Étape 7: Configurer l'App ──────────────────────

Ajouter dans `.env.local` :
```env
NEXT_PUBLIC_NOTIFICATION_WORKER_URL=https://maisondepriere-notifications.votre-subdomain.workers.dev
```

## ── Étape 8: Vérifier ─────────────────────────────

```bash
# Health check
curl https://maisondepriere-notifications.votre-subdomain.workers.dev/health

# Devrait retourner :
# {
#   "status": "ok",
#   "service": "notification-worker",
#   "version": "2.0.0",
#   "vapid_configured": true,
#   "supabase_configured": true,
#   "features": ["aggregation", "kv-counters", ...]
# }
```

## ── Tester l'envoi ────────────────────────────────

```bash
# Tester POST /notify
curl -X POST https://maisondepriere-notifications.votre-subdomain.workers.dev/notify \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "prayer_prayed",
    "actor_id": "test-user-1",
    "actor_name": "Pierre",
    "recipient_id": "test-user-2",
    "target_id": "prayer-123",
    "target_name": "Ma demande de prière"
  }'
```

## ── Commandes Utiles ──────────────────────────────

```bash
# Dev local (avec tunnel)
npx wrangler dev

# Voir les logs en temps réel
npx wrangler tail

# Vérifier la config
npx wrangler whoami
npx wrangler kv namespace list

# Mettre à jour
npx wrangler deploy
```

## ── Endpoints API ─────────────────────────────────

| Méthode | Route               | Description                        | Auth Header   |
|---------|---------------------|------------------------------------|---------------|
| POST    | /notify             | Envoyer un événement notification  | —             |
| GET     | /notify/count       | Compteur non-lus (KV, rapide)      | X-User-Id     |
| PATCH   | /notify/read        | Marquer une notif lue              | X-User-Id     |
| PATCH   | /notify/read-all    | Tout marquer lu                    | X-User-Id     |
| GET     | /notify/list        | Pagination cursor-based            | X-User-Id     |
| GET     | /notify/preferences | Préférences utilisateur            | X-User-Id     |
| PATCH   | /notify/preferences | Modifier préférences               | X-User-Id     |
| POST    | /api/push/register  | Enregistrer token push             | —             |
| GET     | /api/push/vapid-key | Clé publique VAPID                 | —             |
| GET     | /health             | Health check                       | —             |

## ── Cron (Automatique) ────────────────────────────

Le Cron Trigger s'exécute **toutes les heures** et :
1. Cherche les demandes de prière > 48h sans aucune prière
2. Envoie une notification `prayer_no_response` au propriétaire
3. Utilise déduplication KV pour ne pas renvoyer (TTL 7 jours)

## ── Limites Free Tier ─────────────────────────────

| Ressource         | Limite Free Tier  | Votre usage estimé |
|--------------------|------------------|--------------------|
| Worker requests    | 100k/jour        | ~5-10k/jour        |
| KV reads           | 100k/jour        | ~10-20k/jour       |
| KV writes          | 1k/jour          | ~500-800/jour      |
| Queue messages     | 10k/jour         | ~2-5k/jour         |
| Cron executions    | 5/min            | 1/heure            |

✅ Votre usage estimé est bien dans les limites du free tier.
