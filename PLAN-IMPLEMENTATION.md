# 📋 Plan d'Implémentation — Maison de Prière V2

## ✅ FAIT (déjà implémenté dans cette session)

### Push Notifications Deep-Link
- ✅ `notifyDirectMessage` envoie `conversationId` dans action_data
- ✅ `notifyGroupNewMessage` envoie `groupId` dans action_data
- ✅ `handleNotifClick` dans `notification-bell.tsx` navigue vers la conversation exacte
- ✅ Service Worker (`sw.js`) gère les URL `?nav=conversation&id=xxx`
- ✅ `page.tsx` parse les URL params et les transforme en `pendingNavigation`
- ✅ `community-view.tsx` consomme `pendingNavigation` et ouvre la bonne vue

### Admin Panel
- ✅ `live_proxy_url` → `cloudflare_worker_url` dans Supabase
- ✅ `push-notification-manager.tsx` lit depuis `NEXT_PUBLIC_WORKER_URL` OU `app_settings.cloudflare_worker_url`
- ✅ Toutes les références Fly.io supprimées

### Labyrinthe
- ✅ Personnages bibliques : Lion de Juda 🦁, Blé de Ruth 🌾, Colombe 🕊️, Agneau 🐑, Étoile ⭐, Poisson 🐟
- ✅ D-pad responsive (plus petit sur mobile, plus grand sur desktop)
- ✅ Vue full-screen avec `fixed inset-0 z-50`
- ✅ Touch controls améliorés

### Prières
- ✅ Champ "Objet de la requête" ajouté
- ✅ Objet affiché en gras dans le feed
- ✅ Badge demandes d'amitié sur "Retrouver vos amis"
- ✅ Bouton "Jeux Bibliques" → redirige vers l'onglet Games

---

## 🔧 À FAIRE — Priorité 1 (Chat & Groupes)

### 1. Header de groupe responsive (style WhatsApp)
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Problème**: Le conteneur de chat est trop long, cache le header
- **Solution**: Header sticky (`sticky top-0 z-10`), chat scrollable dans un `flex-1 overflow-y-auto`
- **Complexité**: ⭐⭐

### 2. Boutons "Outils du groupe", appel audio/vidéo trop petits
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: Augmenter les tailles (`h-10 w-10` → `h-11 w-11`, icônes `h-5 w-5`)
- **Complexité**: ⭐

### 3. Dé-épinglage des messages
- **Fichier**: `src/components/community/whatsapp-chat.tsx` ou `group-tools.tsx`
- **Problème**: Impossible de dé-épingler un sujet de prière
- **Solution**: Ajouter bouton ✕ sur l'élément épinglé, supprimer de Supabase
- **Complexité**: ⭐⭐

### 4. Bouton "Répondre à ce message" visible
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Problème**: Seule l'icône 💬 existe, pas de bouton textuel
- **Solution**: Ajouter `<button>Répondre à ce message</button>` sous chaque message
- **Complexité**: ⭐⭐

### 5. Badge flottant Messenger (outils de groupe)
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Problème**: Quand l'admin envoie via "outils du groupe", pas de badge
- **Solution**: Stocker un compteur `group_tool_unread` dans un state local, afficher badge flottant
- **Complexité**: ⭐⭐⭐

### 6. Vitesse d'ouverture des groupes
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Problème**: `openGroup()` fait trop de requêtes séquentielles
- **Solution**: Paralléliser avec `Promise.all()`, utiliser cache localStorage
- **Complexité**: ⭐⭐

### 7. Partage de fichiers (📎 photos, vidéos, documents)
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: 
  - Ajouter bouton 📎 dans la barre d'envoi
  - Upload vers Supabase Storage
  - Support: images, vidéos, PDF, Word, Excel, txt, ePub
  - Preview inline pour images/vidéos
- **Complexité**: ⭐⭐⭐⭐

---

## 🔧 À FAIRE — Priorité 2 (Appels & Communication)

### 8. Appel audio Discord-style (Push-To-Talk)
- **Technologie**: WebRTC + WebSocket signaling
- **Infrastructure requise**:
  - Serveur de signaling WebSocket (Cloudflare Durable Objects ou Supabase Realtime)
  - STUN server: `stun:stun.l.google.com:19302` (gratuit)
  - TURN server: Nécessaire pour NAT traversal (Metered.ca free tier)
- **Fonctionnalités**:
  - Push-To-Talk avec compression Opus
  - Indicateur visuel "X est en train de parler"
  - Auto-mute quand on ne parle pas
- **Complexité**: ⭐⭐⭐⭐⭐

### 9. Appel vidéo de groupe → Google Meet
- **Solution**: Remplacer l'appel vidéo natif par un lien Google Meet
- **API**: Google Calendar API pour créer un meeting
- **Prérequis**: Clé API Google, OAuth consent screen
- **Complexité**: ⭐⭐⭐

### 10. Chat privé — Appels P2P WebRTC
- **Technologie**: WebRTC peer-to-peer
- **Fonctionnalités**:
  - Appel audio 1-to-1
  - Appel vidéo 1-to-1
  - Invitation jusqu'à 4 participants
  - Signaling via Supabase Realtime channels
- **Complexité**: ⭐⭐⭐⭐⭐

---

## 🔧 À FAIRE — Priorité 3 (Stockage optimisé)

### 11. Stockage type WhatsApp (réduction Supabase)
- **Concept**: Les médias lourds sont stockés côté client, seules les métadonnées sont en BDD
- **Architecture**:
  ```
  Supabase DB: messages (texte, metadata, URLs)
  Supabase Storage: fichiers uploadés (avec cleanup automatique après 30j)
  Client IndexedDB: cache local des messages + médias
  ```
- **Étapes**:
  1. Implémenter un service `IndexedDB` pour cache local des messages
  2. Lazy-load des médias (ne charger que quand visible)
  3. Compression côté client avant upload (images: WebP, vidéos: réduction résolution)
  4. Politique de rétention: supprimer les médias de Supabase Storage après 30j
  5. Export de sauvegarde: permettre l'export en JSON crypté
- **Complexité**: ⭐⭐⭐⭐⭐

---

## 📊 Ordre d'exécution recommandé

| # | Tâche | Impact | Effort |
|---|-------|--------|--------|
| 1 | Header groupe responsive | 🔴 Élevé | ⭐⭐ |
| 2 | Boutons plus gros | 🟡 Moyen | ⭐ |
| 3 | Dé-épinglage | 🟡 Moyen | ⭐⭐ |
| 4 | Bouton "Répondre" | 🟡 Moyen | ⭐⭐ |
| 5 | Badge flottant outils | 🟢 Nice-to-have | ⭐⭐⭐ |
| 6 | Vitesse ouverture groupe | 🔴 Élevé | ⭐⭐ |
| 7 | Partage fichiers | 🔴 Élevé | ⭐⭐⭐⭐ |
| 8 | Audio Discord PTT | 🟡 Moyen | ⭐⭐⭐⭐⭐ |
| 9 | Google Meet | 🟢 Nice-to-have | ⭐⭐⭐ |
| 10 | Appels P2P WebRTC | 🟡 Moyen | ⭐⭐⭐⭐⭐ |
| 11 | Stockage WhatsApp | 🟢 Long-terme | ⭐⭐⭐⭐⭐ |
