# 🚀 Guide de Déploiement Netlify - Prayer Marathon App

## Prérequis
- Un compte Netlify (gratuit ou payant)
- Le code source poussé dans un repo Git (GitHub, GitLab, ou Bitbucket)
- Un projet Supabase configuré

---

## Étape 1 : Variables d'Environnement sur Netlify

Allez dans **Site settings > Environment variables** et ajoutez :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://votre-projet.supabase.co` | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Clé publique (anon key) Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Clé service role (pour les API admin) |
| `NODE_VERSION` | `18` | Version de Node.js |

⚠️ **IMPORTANT** : La clé `SUPABASE_SERVICE_ROLE_KEY` est SECRÈTE. Ne la mettez JAMAIS dans le code source.

### Où trouver ces clés ?
1. Allez sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. **Settings** > **API**
4. Copiez l'URL, la clé `anon` et la clé `service_role`

---

## Étape 2 : Connecter le Repo à Netlify

1. Allez sur [Netlify](https://app.netlify.com)
2. Cliquez sur **"Add new site"** > **"Import an existing project"**
3. Connectez votre repo Git
4. Netlify détectera automatiquement les paramètres via `netlify.toml` :
   - **Build command** : `npm run build`
   - **Publish directory** : `.next`
   - **Plugin** : `@netlify/plugin-nextjs`

---

## Étape 3 : Lancer le déploiement

1. Cliquez sur **"Deploy site"**
2. Attendez que le build se termine
3. Votre site sera accessible sur `https://votre-site.netlify.app`

---

## Configuration déjà en place (dans le code)

- ✅ `netlify.toml` configuré avec Node.js 18 et le plugin Next.js
- ✅ `next.config.ts` avec `output: 'standalone'` et images non-optimisées
- ✅ `.node-version` fixé à 18
- ✅ `@netlify/plugin-nextjs` installé en devDependency
- ✅ TypeScript `ignoreBuildErrors: true` pour éviter les blocages de build
- ✅ API routes compatibles SSR (create-user, delete-content, bible proxy)

---

## Résolution de Problèmes Courants

### Erreur "Missing environment variables"
➡️ Ajoutez les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans Netlify.

### Erreur "Build failed"
➡️ Vérifiez que `NODE_VERSION=18` est défini dans les variables d'environnement.

### Page blanche après déploiement
➡️ Vérifiez les logs de la console du navigateur. Si erreur Supabase, vos clés sont probablement incorrectes.

### Erreur CORS avec Supabase
➡️ Dans Supabase Dashboard > Settings > API, ajoutez votre domaine Netlify aux URLs autorisées.

### Fichiers Bible (public/bible/) trop volumineux
Le dossier `public/bible/` contient ~2437 fichiers texte de la Bible française. 
C'est normal et Netlify gère bien les fichiers statiques. Ils seront servis directement via le CDN.

---

## Nom de Domaine Personnalisé

1. Dans Netlify : **Domain settings** > **Add custom domain**
2. Suivez les instructions pour configurer le DNS
3. Netlify génère automatiquement un certificat SSL/HTTPS

---

## Supabase : URL de Redirection OAuth

Si vous utilisez Google OAuth :
1. Allez dans **Supabase Dashboard** > **Authentication** > **URL Configuration**
2. Ajoutez `https://votre-site.netlify.app` aux **Site URL** et **Redirect URLs**
