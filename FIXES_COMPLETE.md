# 🔧 CORRECTIONS MAJEURES - Prayer Marathon App
## Guide de résolution des problèmes Supabase et fonctionnalités

---

## ✅ Problèmes Résolus

### 1. **Erreurs Supabase**
- ✅ Script SQL complet créé: `supabase-complete-v2.sql`
- ✅ Toutes les tables nécessaires incluses
- ✅ Politiques RLS configurées correctement
- ✅ Fonctions et triggers pour l'automatisation

### 2. **Upload des ressources**
- ✅ Table `day_resources` avec structure correcte
- ✅ Support pour: image, video, pdf, audio, text
- ✅ Buckets de stockage requis documentés

### 3. **Programme extensible au-delà de 40 jours**
- ✅ Page admin programme mise à jour: `src/app/admin/content/page.tsx`
- ✅ Paramètre `program_duration` dans `app_settings`
- ✅ Interface pour ajouter des jours sans limite

### 4. **Inscription par numéro de téléphone**
- ✅ Colonne `phone` ajoutée à la table `profiles`
- ✅ Page admin utilisateurs mise à jour: `src/app/admin/users/page.tsx`
- ✅ Support Supabase Auth phone (à activer dans Dashboard)

### 5. **API Bible gratuite**
- ✅ Nouveau service: `src/lib/bible-service.ts`
- ✅ Utilise bible-api.com (100% gratuit, sans clé API)
- ✅ Support des noms de livres en français

### 6. **Chat, Likes, Favoris, Témoignages**
- ✅ Service social complet: `src/lib/social-service.ts`
- ✅ Tables créées pour toutes les fonctionnalités
- ✅ Fonctions RPC pour les likes

---

## 📋 Fichiers Créés/Modifiés

| Fichier | Description |
|---------|-------------|
| `supabase-complete-v2.sql` | Script SQL complet V2 |
| `src/lib/bible-service.ts` | Nouveau service API Bible |
| `src/lib/social-service.ts` | Service fonctionnalités sociales |
| `src/app/admin/content/page.tsx` | Page gestion programme (extensible) |
| `src/app/admin/users/page.tsx` | Page utilisateurs (phone support) |

---

## 🚀 Installation Rapide

### Étape 1: Exécuter le SQL
```sql
-- Copier le contenu de supabase-complete-v2.sql
-- Coller dans Supabase Dashboard > SQL Editor > New Query
-- Cliquer sur RUN
```

### Étape 2: Créer les Buckets de Stockage
Dans **Supabase Dashboard > Storage**, créer:
- `avatars` - Photos de profil
- `resources` - Ressources des jours
- `testimonial-photos` - Photos témoignages
- `prayer-photos` - Photos demandes de prière

### Étape 3: Configurer les Buckets
Pour chaque bucket, aller dans **Policies** et ajouter:

```sql
-- Policy: Allow public read
CREATE POLICY "Public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'NOM_DU_BUCKET');

-- Policy: Allow authenticated uploads
CREATE POLICY "Authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'NOM_DU_BUCKET' AND auth.role() = 'authenticated');

-- Policy: Allow users to delete their own files
CREATE POLICY "Users delete own"
ON storage.objects FOR DELETE
USING (bucket_id = 'NOM_DU_BUCKET' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Étape 4: Activer l'authentification par téléphone (optionnel)
Dans **Supabase Dashboard > Authentication > Providers**:
1. Activer "Phone"
2. Configurer un fournisseur SMS (Twilio, MessageBird, etc.)

---

## 📖 Utilisation du nouveau service Bible

```typescript
import { bibleApiService } from '@/lib/bible-service';

// Obtenir tous les livres
const books = bibleApiService.getBooks();

// Obtenir un chapitre
const chapter = await bibleApiService.getChapterContent('JHN', 3);

// Obtenir un verset spécifique
const verse = await bibleApiService.getVerse('JHN', 3, 16);

// Obtenir le verset du jour
const votd = await bibleApiService.getVerseOfTheDay();

// Obtenir un passage par référence
const passage = await bibleApiService.getPassage('John 3:16-21');
```

---

## 📖 Utilisation du service social

```typescript
import { socialService } from '@/lib/social-service';

// Like un témoignage
await socialService.toggleTestimonialLike(testimonialId, userId);

// Ajouter aux favoris
await socialService.toggleFavorite(userId, 'verse', 'John 3:16', { text: '...' });

// Créer un témoignage
await socialService.createTestimonial(userId, 'Dieu est fidèle!', null, ['photo1.jpg']);

// Envoyer un message privé
await socialService.sendDirectMessage(fromId, toId, 'Salut!');

// Partager du contenu
await socialService.shareContent('verse', 'Jean 3:16 - Car Dieu a tant aimé...');
```

---

## 🔑 Variables d'environnement requises

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_clé_anon
```

---

## 📊 Structure des Tables

### Tables principales
- `profiles` - Utilisateurs (avec support téléphone)
- `days` - Programme journalier
- `day_resources` - Ressources associées aux jours
- `app_settings` - Paramètres de l'application

### Tables sociales
- `testimonials` - Témoignages
- `prayer_requests` - Demandes de prière
- `prayer_groups` - Groupes de prière
- `prayer_group_members` - Membres des groupes
- `prayer_group_messages` - Messages de groupe
- `direct_messages` - Messages privés
- `favorites` - Favoris utilisateurs

### Tables de progression
- `user_progress` - Progression utilisateur
- `journal_entries` - Entrées journal
- `bible_game_results` - Résultats jeux bibliques
- `day_views` - Vues analytiques

---

## ❓ Dépannage

### Erreur: "relation does not exist"
→ Exécutez `supabase-complete-v2.sql` dans le SQL Editor

### Erreur: "permission denied"
→ Vérifiez que les politiques RLS sont créées

### Upload ne fonctionne pas
→ Vérifiez que les buckets existent et ont des policies

### Authentification téléphone ne fonctionne pas
→ Assurez-vous d'avoir configuré un provider SMS dans Supabase

---

## 📞 Support

Si vous rencontrez des problèmes:
1. Vérifiez les logs Supabase (Dashboard > Logs)
2. Vérifiez la console du navigateur (F12 > Console)
3. Assurez-vous que toutes les tables sont créées

---

**Dernière mise à jour:** Aujourd'hui
**Version:** 2.0
