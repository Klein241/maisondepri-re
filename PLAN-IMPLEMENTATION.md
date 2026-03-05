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
- ✅ Personnages Super Mario : 🧑‍🚀 Héros, 🤺 Chevalier, 🥷 Ninja, 🧙 Mage, 🤖 Robot, 🏴‍☠️ Pirate
- ✅ D-pad responsive (plus petit sur mobile, plus grand sur desktop)
- ✅ Vue full-screen avec `fixed inset-0 z-50`
- ✅ Touch controls améliorés
- ✅ Tailles canvas standardisées par appareil (mobile 400×700, tablette 768×900, PC 900×700)
- ✅ Rotation fullscreen paysage sur mobile
- ✅ Image de fond personalisée pour le menu du labyrinthe

### Prières
- ✅ Champ "Objet de la requête" ajouté
- ✅ Objet affiché en gras dans le feed
- ✅ Badge demandes d'amitié sur "Retrouver vos amis"
- ✅ Bouton "Jeux Bibliques" → redirige vers l'onglet Games

---

## ✅ FAIT — Priorité 1 (Chat & Groupes) — Toutes implémentées

### 1. ✅ Header de groupe responsive (style WhatsApp)
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: Header sticky (`sticky top-0 z-20`), backdrop-blur, shrink-0
- **Implémenté le**: 2026-03-05

### 2. ✅ Boutons "Outils du groupe", appel audio/vidéo plus gros
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: `h-9 w-9 sm:h-11 sm:w-11` avec icônes `h-4 w-4 sm:h-5 sm:w-5`
- **Implémenté le**: 2026-03-05

### 3. ✅ Dé-épinglage des messages
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: Bouton ✕ ajouté sur le banner épinglé (visible uniquement pour les admins), suppression dans Supabase
- **Implémenté le**: 2026-03-05

### 4. ✅ Bouton "Répondre à ce message" visible
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: Bouton "↩ Répondre" apparaît au hover sur chaque message, barre de preview du message cité dans la zone de saisie, contenu de réponse intégré dans le message envoyé
- **Implémenté le**: 2026-03-05

### 5. ✅ Badge flottant Messenger (outils de groupe)
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: Badge rouge animé (pulse) sur le bouton Settings, compteur `groupToolUnread`, remis à 0 à l'ouverture des outils
- **Implémenté le**: 2026-03-05

### 6. ✅ Vitesse d'ouverture des groupes
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: `Promise.all([loadMessages(), loadGroupMembers()])` + cache IndexedDB pour affichage instantané + batch des profils senders avec `.in()` au lieu de requêtes individuelles
- **Implémenté le**: 2026-03-05

### 7. ✅ Partage de fichiers (📎 photos, vidéos, documents)
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: 
  - Bouton 📎 dans la barre d'envoi
  - Upload vers Supabase Storage (`chat-files` bucket avec fallback `avatars`)
  - Support: images, vidéos, PDF, Word, Excel, txt, ePub (20 Mo max)
  - Preview inline pour images + lien de téléchargement pour les fichiers
- **Implémenté le**: 2026-03-05

---

## ✅ FAIT — Priorité 2 (Appels & Communication)

### 8. ✅ Appel audio Discord-style (Push-To-Talk)
- **Fichier**: `src/components/community/voice-salon.tsx` (741 lignes)
- **Technologie**: WebRTC + Supabase Realtime signaling
- **Fonctionnalités**:
  - Voice Activity Detection (VAD) pour indicateur "X parle"
  - Push-To-Talk
  - STUN/TURN servers (Google STUN + Metered.ca TURN)
  - Interface Discord-style avec avatars animés
- **Statut**: Composant complet et fonctionnel

### 9. ✅ Appel vidéo de groupe → Google Meet
- **Fichier**: `src/components/community/whatsapp-chat.tsx`
- **Solution**: Bouton vidéo (icône 📹) dans le header du groupe, ouvre `meet.google.com/new` dans un nouvel onglet + envoie un message automatique dans le groupe avec le lien
- **Implémenté le**: 2026-03-05

### 10. ✅ Chat privé — Appels P2P WebRTC
- **Fichier**: `src/components/community/webrtc-call.tsx` (845 lignes) + `call-system.tsx` (412 lignes)
- **Fonctionnalités**:
  - Appel audio et vidéo 1-to-1
  - Signaling via Supabase Realtime broadcast
  - `IncomingCallOverlay` pour les appels entrants (sonnerie + vibration)
  - `initiateCall()` pour signaler un appel distant
  - `DMCallButtons` pour intégration facile dans les conversations privées
  - `useCallListener` hook global monté dans community-view
- **Statut**: Composant complet et fonctionnel

---

## ✅ FAIT — Priorité 3 (Stockage optimisé)

### 11. ✅ Stockage type WhatsApp (réduction Supabase)
- **Fichier**: `src/lib/local-storage-service.ts` (340 lignes)
- **Architecture**:
  ```
  Supabase DB: messages (texte, metadata, URLs)
  Supabase Storage: fichiers uploadés (avec cleanup automatique après 30j)
  Client IndexedDB: cache local des messages + médias
  ```
- **Fonctionnalités implémentées**:
  1. ✅ Service IndexedDB pour cache local des messages (`cacheMessages`, `getCachedGroupMessages`, `getCachedConversationMessages`)
  2. ✅ Lazy-load : messages affichés depuis le cache local instantanément, puis rafraîchis depuis le serveur
  3. ✅ Cache API des médias (`cacheMediaFile`) pour accès offline
  4. ✅ Politique de rétention : `evictOldMedia()` supprime les médias de plus de 30 jours
  5. ✅ Export de sauvegarde : `exportMessagesBackup()` en JSON
  6. ✅ Intégration dans `whatsapp-chat.tsx` : `loadMessages()` charge d'abord depuis IndexedDB puis Supabase

---

## 📊 Tableau récapitulatif final

| # | Tâche | Status | Date |
|---|-------|--------|------|
| 1 | Header groupe responsive | ✅ Fait | 05/03/2026 |
| 2 | Boutons plus gros | ✅ Fait | 05/03/2026 |
| 3 | Dé-épinglage | ✅ Fait | 05/03/2026 |
| 4 | Bouton "Répondre" | ✅ Fait | 05/03/2026 |
| 5 | Badge flottant outils | ✅ Fait | 05/03/2026 |
| 6 | Vitesse ouverture groupe | ✅ Fait | 05/03/2026 |
| 7 | Partage fichiers | ✅ Fait | 05/03/2026 |
| 8 | Audio Discord PTT | ✅ Fait | Existant |
| 9 | Google Meet | ✅ Fait | 05/03/2026 |
| 10 | Appels P2P WebRTC | ✅ Fait | Existant |
| 11 | Stockage WhatsApp | ✅ Fait | 05/03/2026 |

**🎉 Toutes les 11 fonctionnalités sont implémentées et déployées ! 🎉**
