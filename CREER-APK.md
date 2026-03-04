# 📱 Créer l'APK via PWABuilder (Méthode la plus simple)

## Méthode 1 : PWABuilder.com (Recommandé — 3 minutes)

### Étapes :
1. Ouvrez **https://www.pwabuilder.com** dans votre navigateur
2. Entrez l'URL : `https://maisondepriere.netlify.app`
3. Cliquez "**Start**" et attendez l'analyse (~30 secondes)
4. Cliquez sur **"Package for stores"** ou **"Android"**
5. Configurez :
   - **Package ID** : `com.maisondepriere.app`
   - **App name** : `Maison de Prière`
   - **Short name** : `Maison Prière`
   - **App version** : `1.4.0`
   - **Theme color** : `#0F172A`
   - **Background color** : `#0B0E14`
   - **Navigation bar color** : `#0B0E14`
   - ✅ **Enable notifications** : Oui
   - **Signing key** : "Create new" (pour un nouveau keystore)
     - **Alias** : `maisondepriere`
     - **Password** : Choisissez un mot de passe SÉCURISÉ (gardez-le !)
6. Cliquez **"Download"**
7. Vous recevrez un fichier `.zip` contenant :
   - `app-release-signed.apk` → l'APK installable
   - `app-release.aab` → pour Google Play Store
   - Le keystore (`.keystore`) → **GARDEZ-LE PRÉCIEUSEMENT**

### Installation de l'APK :
- Transférez le `.apk` sur votre téléphone Android
- Ouvrez-le pour l'installer
- Si bloqué : Paramètres → Sécurité → "Sources inconnues" → Activer

---

## Méthode 2 : Bubblewrap CLI (Avancé)

### Prérequis :
- Java JDK 17+ ✅ (installé)
- Android SDK ✅ (installé dans `%LOCALAPPDATA%\Android\Sdk`)
- Gradle 8.5+ (à télécharger)

### Commandes :
```powershell
# Configurer les variables d'environnement
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot"

# Initialiser avec Bubblewrap
cd apk-build
npx @bubblewrap/cli init --manifest="https://maisondepriere.netlify.app/manifest.json"

# Répondre aux questions :
# - JDK : Non (déjà installé)
# - Android SDK : Non (spécifier le chemin local)
# - Keystore : Générer un nouveau

# Builder
npx @bubblewrap/cli build
```

---

## Méthode 3 : Android Studio (Contrôle total)

### Étapes :
1. Ouvrez le dossier `android-app/` dans Android Studio
2. File → Sync Project with Gradle Files
3. Build → Generate Signed Bundle/APK
4. Suivez l'assistant de signature

---

## 🔑 Fichier Digital Asset Links

Après avoir généré le keystore, obtenez le SHA-256 :
```bash
keytool -list -v -keystore votre-keystore.keystore -alias maisondepriere
```

Puis mettez à jour le fichier `public/.well-known/assetlinks.json` :
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.maisondepriere.app",
    "sha256_cert_fingerprints": ["VOTRE_SHA256_ICI"]
  }
}]
```

## 📦 Publication Google Play Store

1. Créez un compte développeur : https://play.google.com/console
2. Frais : 25$ (une seule fois)
3. Uploadez le fichier `.aab` (Android App Bundle)
4. Remplissez la fiche de l'application
5. Soumettez pour révision (~1-3 jours)
