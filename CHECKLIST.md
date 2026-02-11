# ✅ Checklist de configuration - Prayer Marathon App

## 📋 Avant de commencer

- [ ] Node.js 18+ installé
- [ ] Compte Supabase créé
- [ ] Projet Supabase configuré
- [ ] Clés API Supabase copiées dans `.env.local`

---

## 🗄️ Étape 1 : Configuration de la base de données

### Tables SQL
- [ ] Ouvrir Supabase Dashboard
- [ ] Aller dans **SQL Editor**
- [ ] Créer une nouvelle requête
- [ ] Copier le contenu de `supabase-migrations.sql`
- [ ] Exécuter la requête
- [ ] Vérifier qu'il n'y a pas d'erreurs

### Vérification des tables
- [ ] `day_resources` existe
- [ ] `testimonials` existe (avec colonne `is_approved`)
- [ ] `prayer_requests` existe
- [ ] `profiles` existe
- [ ] `days` existe
- [ ] `app_notifications` existe

**Test** : Exécuter `verify-setup.sql` dans SQL Editor

---

## 📦 Étape 2 : Configuration du stockage

### Bucket 1 : day-resources
- [ ] Créer le bucket `day-resources`
- [ ] Activer **Public bucket**
- [ ] Définir la taille max : `52428800` (50MB)
- [ ] MIME types : `image/*,video/*,audio/*,application/pdf`
- [ ] Créer la policy **Public Access** (SELECT)
- [ ] Créer la policy **Authenticated Insert**
- [ ] Créer la policy **Authenticated Update**
- [ ] Créer la policy **Authenticated Delete**

### Bucket 2 : testimonial-photos
- [ ] Créer le bucket `testimonial-photos`
- [ ] Activer **Public bucket**
- [ ] Définir la taille max : `10485760` (10MB)
- [ ] MIME types : `image/*`
- [ ] Créer la policy **Public Access** (SELECT)
- [ ] Créer la policy **Users can upload own photos** (INSERT)
- [ ] Créer la policy **Users can update own photos** (UPDATE)
- [ ] Créer la policy **Users can delete own photos** (DELETE)

### Bucket 3 : avatars
- [ ] Créer le bucket `avatars`
- [ ] Activer **Public bucket**
- [ ] Définir la taille max : `5242880` (5MB)
- [ ] MIME types : `image/*`
- [ ] Créer les 4 policies (même que testimonial-photos)

**Test** : Vérifier que les 3 buckets apparaissent dans Storage

---

## 🔐 Étape 3 : Configuration de l'authentification

- [ ] Aller dans **Authentication** > **Providers**
- [ ] Activer **Email** provider
- [ ] (Optionnel) Activer **Google OAuth**
- [ ] Configurer les URL de redirection si nécessaire

---

## 🚀 Étape 4 : Lancer l'application

### Installation
- [ ] Ouvrir le terminal dans le dossier du projet
- [ ] Exécuter `npm install`
- [ ] Vérifier qu'il n'y a pas d'erreurs

### Configuration
- [ ] Vérifier que `.env.local` contient :
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://holomdzjifrgirkjuaqv.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_clé_anon
  ```

### Démarrage
- [ ] Exécuter `npm run dev`
- [ ] Ouvrir http://localhost:3000
- [ ] Vérifier que l'app se charge sans erreur

---

## 🧪 Étape 5 : Tests des fonctionnalités

### Dashboard Admin
- [ ] Aller sur http://localhost:3000/admin
- [ ] Vérifier que le **SystemStatusCard** affiche tout en vert ✅
- [ ] Vérifier que les statistiques se chargent

### Ressources Journalières
- [ ] Aller sur http://localhost:3000/admin/resources
- [ ] Sélectionner le Jour 1
- [ ] Cliquer sur **Ajouter**
- [ ] Essayer d'uploader une image (< 50MB)
- [ ] Vérifier que l'upload fonctionne
- [ ] Vérifier que la ressource apparaît dans la liste

### Modération
- [ ] Aller sur http://localhost:3000/admin/moderation
- [ ] Vérifier que les témoignages s'affichent
- [ ] Tester le bouton d'approbation (icône verte)
- [ ] Vérifier que le badge change (Approuvé ↔ En attente)
- [ ] Tester la suppression d'un témoignage

### Communications
- [ ] Aller sur http://localhost:3000/admin/notifications
- [ ] Remplir le formulaire de notification
- [ ] Envoyer une notification test
- [ ] Vérifier qu'elle apparaît dans l'historique

### Programme
- [ ] Aller sur http://localhost:3000/admin/content
- [ ] Si la table est vide, cliquer sur **Initialiser le programme (Seed)**
- [ ] Vérifier que les 40 jours apparaissent
- [ ] Tester l'édition d'un jour

---

## 🎯 Étape 6 : Tests utilisateur

### Témoignages avec photos
- [ ] Se connecter en tant qu'utilisateur
- [ ] Utiliser le composant `AddTestimonialDialog`
- [ ] Ajouter un témoignage avec photo
- [ ] Vérifier que la photo s'upload correctement
- [ ] Vérifier que le témoignage apparaît dans la modération
- [ ] L'approuver depuis l'admin
- [ ] Vérifier qu'il apparaît dans la communauté

---

## ✨ Étape 7 : Optimisations (Optionnel)

### Performance
- [ ] Activer la mise en cache Supabase
- [ ] Optimiser les images (WebP)
- [ ] Configurer les CDN si nécessaire

### Sécurité
- [ ] Vérifier que RLS est activé sur toutes les tables
- [ ] Tester les permissions (utilisateur normal ne peut pas accéder à /admin)
- [ ] Configurer les CORS si nécessaire

### Monitoring
- [ ] Configurer les logs Supabase
- [ ] Surveiller l'utilisation du stockage
- [ ] Surveiller les requêtes API

---

## 🎉 Configuration terminée !

Si toutes les cases sont cochées ✅, votre backoffice admin est **100% opérationnel** !

### Prochaines étapes :
1. Inviter des utilisateurs test
2. Ajouter du contenu pour les 40 jours
3. Configurer les notifications push
4. Personnaliser le design si nécessaire

---

## 📞 Besoin d'aide ?

### Problèmes courants :

**❌ Bucket not found**
→ Retourner à l'Étape 2 et créer le bucket manquant

**❌ Table does not exist**
→ Retourner à l'Étape 1 et réexécuter `supabase-migrations.sql`

**❌ Permission denied**
→ Vérifier les policies du bucket (Étape 2)

**❌ Upload failed**
→ Vérifier la taille du fichier et le type MIME

### Documentation :
- [`QUICK_START.md`](./QUICK_START.md) - Guide rapide
- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) - Configuration détaillée
- [`ADMIN_BACKOFFICE_COMPLETE.md`](./ADMIN_BACKOFFICE_COMPLETE.md) - Fonctionnalités complètes

---

**Dernière mise à jour** : 2026-02-04
**Version** : 1.0.0
