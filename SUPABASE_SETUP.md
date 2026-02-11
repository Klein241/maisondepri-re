# Configuration Supabase - Prayer Marathon App

## 🗄️ Étape 1: Exécuter les migrations SQL

1. Ouvrez votre projet Supabase: https://holomdzjifrgirkjuaqv.supabase.co
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête
4. Copiez tout le contenu du fichier `supabase-migrations.sql`
5. Exécutez la requête
6. Vérifiez qu'il n'y a pas d'erreurs

## 📦 Étape 2: Créer les buckets de stockage

### Bucket 1: `day-resources`
1. Allez dans **Storage** > **New bucket**
2. Nom: `day-resources`
3. Public: ✅ **Activé**
4. File size limit: `52428800` (50MB)
5. Allowed MIME types: `image/*,video/*,audio/*,application/pdf`
6. Cliquez sur **Create bucket**

#### Policies pour `day-resources`:
```sql
-- SELECT (Public read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'day-resources' );

-- INSERT (Authenticated users)
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);

-- UPDATE (Authenticated users)
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);

-- DELETE (Authenticated users)
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);
```

### Bucket 2: `testimonial-photos`
1. Allez dans **Storage** > **New bucket**
2. Nom: `testimonial-photos`
3. Public: ✅ **Activé**
4. File size limit: `10485760` (10MB)
5. Allowed MIME types: `image/*`
6. Cliquez sur **Create bucket**

#### Policies pour `testimonial-photos`:
```sql
-- SELECT (Public read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'testimonial-photos' );

-- INSERT (Users can upload their own)
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'testimonial-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE (Users can update their own)
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'testimonial-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE (Users can delete their own)
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'testimonial-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Bucket 3: `avatars`
1. Allez dans **Storage** > **New bucket**
2. Nom: `avatars`
3. Public: ✅ **Activé**
4. File size limit: `5242880` (5MB)
5. Allowed MIME types: `image/*`
6. Cliquez sur **Create bucket**

#### Policies pour `avatars`:
```sql
-- SELECT (Public read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- INSERT (Users can upload their own)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE (Users can update their own)
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE (Users can delete their own)
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## 🔐 Étape 3: Vérifier les Row Level Security (RLS)

1. Allez dans **Database** > **Tables**
2. Pour chaque table, vérifiez que RLS est activé
3. Vérifiez les policies créées

## ✅ Étape 4: Tester la configuration

1. Testez l'ajout d'une ressource journalière
2. Testez l'upload d'une photo de témoignage
3. Vérifiez que les fichiers sont bien stockés dans les buckets

## 🚨 Dépannage

### Erreur "Bucket not found"
- Vérifiez que le bucket existe dans Storage
- Vérifiez le nom exact du bucket (sensible à la casse)
- Vérifiez que le bucket est public

### Erreur "Could not find the table"
- Exécutez à nouveau le script SQL de migration
- Vérifiez dans Database > Tables que toutes les tables existent

### Erreur d'upload
- Vérifiez les policies du bucket
- Vérifiez que l'utilisateur est authentifié
- Vérifiez la taille du fichier (ne doit pas dépasser la limite)
- Vérifiez le type MIME du fichier

## 📝 Notes importantes

- Les buckets doivent être créés **manuellement** via le Dashboard Supabase
- Les policies de stockage doivent être ajoutées **après** la création des buckets
- Testez toujours avec un fichier de petite taille d'abord
- Vérifiez les logs dans Supabase pour déboguer les erreurs
