# 🚀 Guide de démarrage rapide - Backoffice Admin

## ⚡ 3 étapes pour activer toutes les fonctionnalités

### Étape 1️⃣ : Exécuter les migrations SQL (5 minutes)

1. Ouvrez votre navigateur et allez sur : https://holomdzjifrgirkjuaqv.supabase.co
2. Connectez-vous à votre projet Supabase
3. Dans le menu de gauche, cliquez sur **SQL Editor**
4. Cliquez sur **New query**
5. Ouvrez le fichier `supabase-migrations.sql` dans votre éditeur
6. Copiez **tout le contenu** du fichier
7. Collez-le dans l'éditeur SQL de Supabase
8. Cliquez sur **Run** (bouton en bas à droite)
9. Attendez que l'exécution se termine (vous devriez voir "Success")

✅ **Vérification** : Allez dans **Database** > **Tables** et vérifiez que vous voyez :
- `day_resources`
- `testimonials`
- `prayer_requests`
- `profiles`
- `days`

---

### Étape 2️⃣ : Créer les buckets de stockage (10 minutes)

#### Bucket 1 : `day-resources`

1. Dans Supabase, allez dans **Storage** (menu de gauche)
2. Cliquez sur **New bucket**
3. Remplissez :
   - **Name** : `day-resources`
   - **Public bucket** : ✅ Cochez la case
   - **File size limit** : `52428800` (50MB)
   - **Allowed MIME types** : `image/*,video/*,audio/*,application/pdf`
4. Cliquez sur **Create bucket**

5. **Configurer les policies** :
   - Cliquez sur le bucket `day-resources`
   - Allez dans l'onglet **Policies**
   - Cliquez sur **New policy**
   - Sélectionnez **For full customization**
   - Créez 4 policies :

**Policy 1 - Public Read** :
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'day-resources' );
```

**Policy 2 - Authenticated Insert** :
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);
```

**Policy 3 - Authenticated Update** :
```sql
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);
```

**Policy 4 - Authenticated Delete** :
```sql
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);
```

#### Bucket 2 : `testimonial-photos`

1. Cliquez sur **New bucket**
2. Remplissez :
   - **Name** : `testimonial-photos`
   - **Public bucket** : ✅ Cochez la case
   - **File size limit** : `10485760` (10MB)
   - **Allowed MIME types** : `image/*`
3. Cliquez sur **Create bucket**

4. **Configurer les policies** (même processus que ci-dessus) :

```sql
-- Public Read
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'testimonial-photos' );

-- User Insert
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'testimonial-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User Update
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'testimonial-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User Delete
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'testimonial-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

#### Bucket 3 : `avatars`

1. Cliquez sur **New bucket**
2. Remplissez :
   - **Name** : `avatars`
   - **Public bucket** : ✅ Cochez la case
   - **File size limit** : `5242880` (5MB)
   - **Allowed MIME types** : `image/*`
3. Cliquez sur **Create bucket**

4. **Configurer les policies** (même que testimonial-photos, changez juste `bucket_id = 'avatars'`)

✅ **Vérification** : Dans **Storage**, vous devriez voir 3 buckets :
- `day-resources` (50MB)
- `testimonial-photos` (10MB)
- `avatars` (5MB)

---

### Étape 3️⃣ : Tester les fonctionnalités (5 minutes)

1. **Démarrez votre application** :
   ```bash
   npm run dev
   ```

2. **Testez la page Ressources** :
   - Allez sur : http://localhost:3000/admin/resources
   - Sélectionnez un jour (ex: Jour 1)
   - Cliquez sur **Ajouter**
   - Essayez d'uploader une image
   - Si ça fonctionne ✅ = Bucket configuré correctement !

3. **Testez la page Modération** :
   - Allez sur : http://localhost:3000/admin/moderation
   - Vérifiez que les témoignages s'affichent
   - Testez le bouton d'approbation
   - Si ça fonctionne ✅ = Table testimonials OK !

4. **Testez les Communications** :
   - Allez sur : http://localhost:3000/admin/notifications
   - Envoyez une notification test
   - Si ça fonctionne ✅ = Tout est OK !

---

## 🆘 Dépannage rapide

### ❌ Erreur "Bucket not found"
**Solution** : Retournez à l'Étape 2 et créez le bucket manquant

### ❌ Erreur "Table does not exist"
**Solution** : Retournez à l'Étape 1 et réexécutez le script SQL

### ❌ Erreur "Permission denied"
**Solution** : Vérifiez les policies du bucket (Étape 2)

### ❌ L'upload ne fonctionne pas
**Solution** : 
1. Vérifiez que le bucket est **public**
2. Vérifiez que les policies sont créées
3. Vérifiez la taille du fichier (max 50MB pour day-resources)

---

## 📞 Besoin d'aide ?

1. Consultez `SUPABASE_SETUP.md` pour plus de détails
2. Consultez `ADMIN_BACKOFFICE_COMPLETE.md` pour la liste complète des fonctionnalités
3. Exécutez `verify-setup.sql` dans Supabase pour vérifier votre configuration

---

## ✨ C'est tout !

Une fois ces 3 étapes terminées, **toutes les fonctionnalités du backoffice admin seront opérationnelles** ! 🎉

**Temps total estimé : 20 minutes**
