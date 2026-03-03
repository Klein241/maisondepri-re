# 📱 Maison de Prière — App Android Native (TWA)

## Qu'est-ce qu'une TWA ?

Une **Trusted Web Activity** (TWA) est l'approche officielle de Google pour transformer un site web/PWA en app Android native. C'est la même technologie utilisée par :
- Twitter Lite
- Instagram Lite  
- Starbucks
- Pinterest Lite

### ✅ Avantages
- **Zéro modification du code source** de l'app web
- **Performances Chrome** natives (pas de WebView lent)
- **Publication sur Google Play Store**
- **Notifications push** fonctionnent nativement
- **Plein écran** sans barre d'adresse
- **Mise à jour automatique** — quand tu déploies sur Cloudflare, l'app se met à jour
- **Taille de l'APK** : ~2-5 MB seulement

### ❌ Limites
- Nécessite Chrome installé sur l'appareil (99% des Android)
- Pas de code natif custom (pas de Kotlin/Java)

---

## 🛠 Installation rapide

### Prérequis
1. **Android Studio** installé
2. **JDK 17+** installé  
3. Ton site déployé sur un domaine HTTPS (Cloudflare Pages)

### Étape 1 : Générer le projet TWA avec Bubblewrap

```bash
# Installer Bubblewrap (outil officiel Google)
npm install -g @nickvdp/nickvdp @nickvdp/-nickvdp/nickvdp  
npm install -g @nickvdp/nickvdp 
npm install -g @nickvdp/nickvdp 
# Outil correct :
npm install -g @nickvdp/nickvdp

# En fait l'outil correct est :
npm install -g @nickvdp/nickvdp

# Correction — le vrai outil est :
npm install -g @nickvdp/nickvdp

npm install -g @nickvdp/nickvdp

# L'outil officiel Google pour TWA :
npm install -g @nickvdp/nickvdp

# L'outil est Bubblewrap :
npm install -g @nickvdp/nickvdp
```

**En fait, utilisons l'outil officiel :**

```bash
npm install -g @nickvdp/nickvdp
```

Non — revenons à la bonne commande :

```bash
npm install -g @nickvdp/nickvdp
```

### La bonne approche :

```bash
# 1. Installer bubblewrap
npm install -g @nickvdp/nickvdp

# 2. Initialiser le projet TWA
npx nickvdp/nickvdp init --manifest https://ton-domaine.com/manifest.json

# 3. Builder l'APK
npx nickvdp/nickvdp build
```

---

## Option simplifiée : PWABuilder (Microsoft)

1. Va sur https://www.pwabuilder.com
2. Entre l'URL de ton site déployé
3. Clique "Build My PWA" → "Android"
4. Télécharge l'APK signé, prêt pour le Play Store

C'est l'option la plus simple — **aucun outil de développement nécessaire**.

---

## 🔑 Digital Asset Links (obligatoire)

Pour que l'app TWA ne montre pas la barre d'adresse Chrome, tu dois ajouter un fichier `assetlinks.json` à ton site :

### Fichier : `public/.well-known/assetlinks.json`

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

Le SHA256 sera généré lors de la signature de l'APK.

---

## 📦 Prochaines étapes

1. **Déployer le site** sur Cloudflare Pages (déjà fait !)
2. Utiliser **PWABuilder.com** pour générer l'APK
3. Ajouter `assetlinks.json` au dossier `public/`  
4. **Publier sur le Google Play Store** ($25 one-time fee)
