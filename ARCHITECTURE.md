# 🏗️ Architecture — Maison de Prière

## ⚠️ IMPORTANT : Export Statique (SPA)

Ce projet utilise **Next.js en mode export statique** (`output: 'export'`).  
Le site est déployé sur **Netlify comme site statique pur** (pas de serverless).

### Règles impératives

1. **JAMAIS de routes API** (`src/app/api/`) — Elles seront ignorées par le build
2. **JAMAIS de SSR** — Pas de `headers()`, `cookies()`, `next/server` dans les pages
3. **JAMAIS de routes dynamiques** sans `generateStaticParams()`
4. **TOUJOURS** utiliser le Supabase SDK côté client pour les données
5. **Si une logique serveur est nécessaire** → Supabase Edge Functions

### Architecture data-fetching

```
Navigateur → Supabase SDK (directement)
           ↗ src/lib/api-client.ts (messages, profils, bible)
           ↗ src/lib/admin-client.ts (opérations admin)
           ↗ supabase.from('table').select/insert/update/delete
```

### Build & Déploiement

```bash
npm run build        # Génère out/ (HTML statique)
# Netlify déploie out/ automatiquement
```

### Variables d'environnement (Netlify)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Pourquoi ?

L'ancienne architecture SSR + API routes consommait **~300 crédits Netlify/jour** pour 50 utilisateurs.  
L'export statique consomme **0 crédit** pour le rendu des pages. Seul le bandwidth CDN est utilisé (100 GB gratuits).
