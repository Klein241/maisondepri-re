# 📱 Maison de Prière — Application Android (TWA)

## 📋 Architecture

```
android-app/
├── app/
│   ├── build.gradle.kts          ← Config app + dépendances
│   ├── proguard-rules.pro        ← Optimisation APK
│   └── src/main/
│       ├── AndroidManifest.xml   ← Permissions, TWA config, deep links
│       └── res/
│           ├── values/
│           │   ├── strings.xml   ← Nom app + Digital Asset Links
│           │   ├── colors.xml    ← Couleurs (dark theme)
│           │   └── styles.xml    ← Thèmes (splash, app)
│           ├── xml/
│           │   ├── network_security_config.xml
│           │   └── file_paths.xml
│           └── mipmap-*/         ← Icônes (à ajouter)
├── build.gradle.kts              ← Config projet racine
├── settings.gradle.kts           ← Structure du projet
├── gradle.properties             ← Propriétés Gradle
└── gradle/wrapper/               ← Gradle wrapper
```

## 🚀 Guide de publication Play Store

### Étape 1 : Préparer les icônes

Copie tes icônes PWA dans les dossiers mipmap :

```
app/src/main/res/mipmap-mdpi/ic_launcher.png      (48x48)
app/src/main/res/mipmap-hdpi/ic_launcher.png       (72x72)
app/src/main/res/mipmap-xhdpi/ic_launcher.png      (96x96)
app/src/main/res/mipmap-xxhdpi/ic_launcher.png     (144x144)
app/src/main/res/mipmap-xxxhdpi/ic_launcher.png    (192x192)
```

**Astuce rapide** : Utilise https://icon.kitchen pour générer tous les formats à partir de ton `icon-512.png`.

### Étape 2 : Configurer le domaine

Dans `app/build.gradle.kts`, modifie la ligne :
```kotlin
manifestPlaceholders["hostName"] = "maisondepriere.netlify.app"
```

### Étape 3 : Générer le keystore de signature

```bash
keytool -genkey -v \
  -keystore maisondepriere.keystore \
  -alias maisondepriere \
  -keyalg RSA \
  -keysize 2048 \
  -validity 36500 \
  -storepass VOTRE_MOT_DE_PASSE \
  -keypass VOTRE_MOT_DE_PASSE \
  -dname "CN=Maison de Priere, OU=App, O=SYGMA-TECH, L=Paris, ST=IDF, C=FR"
```

⚠️ **IMPORTANT** : Sauvegardez ce fichier `.keystore` dans un endroit sûr ! Si vous le perdez, vous ne pourrez JAMAIS mettre à jour votre app sur le Play Store.

### Étape 4 : Obtenir le SHA256 fingerprint

```bash
keytool -list -v -keystore maisondepriere.keystore -alias maisondepriere
```

Copiez la ligne `SHA256:` qui ressemble à :
```
AB:CD:EF:12:34:56:78:90:...
```

### Étape 5 : Configurer les Digital Asset Links

1. **Dans le projet Android** — `app/src/main/res/values/strings.xml` :
   - La valeur `asset_statements` est déjà configurée ✅

2. **Sur votre site web** — `public/.well-known/assetlinks.json` :
   - Remplacez `REMPLACEZ_PAR_VOTRE_SHA256_FINGERPRINT` par votre fingerprint
   - Redéployez le site

3. **Vérifier** : Visitez `https://votre-domaine/.well-known/assetlinks.json` dans un navigateur

### Étape 6 : Activer la signature dans build.gradle.kts

Décommentez la section `signingConfigs` dans `app/build.gradle.kts` et remplissez vos valeurs.

### Étape 7 : Builder l'APK/AAB

```bash
# Ouvrir le projet dans Android Studio
# File → Open → sélectionner le dossier android-app/

# Ou en ligne de commande :
cd android-app
./gradlew assembleRelease      # Génère un APK
./gradlew bundleRelease         # Génère un AAB (recommandé pour Play Store)
```

Le fichier de sortie sera dans :
- APK : `app/build/outputs/apk/release/app-release.apk`
- AAB : `app/build/outputs/bundle/release/app-release.aab`

### Étape 8 : Publier sur le Play Store

1. Créez un compte développeur Google Play : https://play.google.com/console ($25 unique)
2. Créez une nouvelle application
3. Remplissez les informations :
   - **Nom** : Maison de Prière
   - **Description courte** : Marathon spirituel de 40 jours de jeûne et prière
   - **Catégorie** : Mode de vie → Religion/Spiritualité
   - **Classification du contenu** : Tout public
4. Uploadez votre fichier `.aab`
5. Configurez le prix (Gratuit)
6. Soumettez pour examen

---

## ❓ FAQ

### L'app se met-elle à jour automatiquement ?
**Oui !** C'est le plus grand avantage de TWA. Quand vous déployez une mise à jour sur Cloudflare/Netlify, l'app Android se met à jour automatiquement sans passer par le Play Store.

### Les notifications push fonctionnent-elles ?
**Oui !** Les Web Push Notifications fonctionnent nativement dans une TWA car elle utilise Chrome.

### WebRTC (appels audio/vidéo) fonctionne-t-il ?
**Oui !** Chrome dans une TWA supporte pleinement WebRTC, y compris getUserMedia pour le micro et la caméra.

### Quelle est la taille de l'APK ?
Environ **2-5 MB** seulement, car l'app ne contient que le "wrapper" Android — tout le contenu est chargé depuis votre site.

### Faut-il Chrome installé ?
Chrome doit être installé sur l'appareil, mais il est préinstallé sur 99% des appareils Android.
