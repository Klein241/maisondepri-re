# 📋 Analyse des Fonctionnalités — Maison de Prière V1.4

## État réel du code (analyse chirurgicale du 4 mars 2026)

### Fichier principal: `whatsapp-chat.tsx` (5138 lignes, 270 Ko)

---

## ✅ FONCTIONNALITÉS DÉJÀ IMPLÉMENTÉES

### 1. Système d'appels WebRTC
- **Fichier**: `webrtc-call.tsx` (845 lignes) — **IMPLÉMENTÉ ✅**
  - Appel audio P2P via WebRTC
  - Appel vidéo P2P via WebRTC
  - Serveurs STUN (Google) + TURN (Metered.ca) configurés
  - Signaling via Supabase broadcast
  - Timer de durée d'appel
  - Mute audio / Désactiver vidéo
  - UI complète avec avatar, statut de connexion
  - **Intégré** dans `whatsapp-chat.tsx` (ligne 5086: `<WebRTCCall>`)

### 2. Système d'appels entrants
- **Fichier**: `call-system.tsx` (412 lignes) — **IMPLÉMENTÉ ✅**
  - `IncomingCallOverlay` : écran d'appel entrant avec sonnerie
  - `useCallListener` : hook global pour détecter les appels entrants
  - `initiateCall` : fonction pour démarrer un appel
  - `DMCallButtons` : boutons audio/vidéo pour les conversations privées
  - Signaling via Supabase broadcast channels

### 3. Salon vocal Discord-style
- **Fichier**: `voice-salon.tsx` (741 lignes) — **IMPLÉMENTÉ ✅**
  - Salon vocal de groupe avec WebRTC
  - Voice Activity Detection (VAD) pour indicateur "parle"
  - Push-To-Talk et mode continu
  - STUN/TURN configurés
  - **Intégré** dans `whatsapp-chat.tsx` (ligne 5123-5130: `<VoiceSalon>`)

### 4. Outils de groupe complets
- **Fichier**: `group-tools.tsx` (1370 lignes) — **IMPLÉMENTÉ ✅**
  - `GroupPollWidget` : Sondages avec votes, options multiples, anonymat
  - `CollectivePrayerCounter` : Compteur de prière collectif temps réel
  - `GroupEventsWidget` : Événements/calendrier de groupe
  - `GroupToolsPanel` : Panel avec 5+ outils (sondages, annonces, versets, programmes, événements)
  - **Intégré** dans `whatsapp-chat.tsx` (ligne 4265: `<GroupToolsPanel>`)

### 5. Épinglage de sujets de prière
- Dans `whatsapp-chat.tsx` — **IMPLÉMENTÉ ✅**
  - `pinnedPrayer` : État pour sujet épinglé (ligne 279)
  - `setPinnedPrayerSubject` : Fonction pour épingler (ligne 4787)
  - **DÉ-ÉPINGLAGE IMPLÉMENTÉ** : `unpinNotificationForAll` (ligne 1866)
  - Broadcast de dé-épinglage à tous les membres
  - Bouton "Admin unpin-for-all" (ligne 3662)

### 6. Réponse à un message (Reply)
- Dans `whatsapp-chat.tsx` — **IMPLÉMENTÉ ✅**
  - `replyTo` state (ligne 284)
  - Citation du message original dans le nouveau message (ligne 1064-1068)
  - UI de réponse avec aperçu et bouton ✕ (lignes 4074-4085)
  - Bouton "Répondre" sous chaque message (ligne 3963-3977)

### 7. Partage de fichiers (📎)
- Dans `whatsapp-chat.tsx` — **IMPLÉMENTÉ ✅**
  - Import `Paperclip` (ligne 7)
  - Bouton 📎 dans la barre d'envoi (ligne 4162)
  - Champs `image_url`, `file_url` dans le type Message (lignes 85-86)
  - Rendu des images inline (lignes 3876-3882)
  - Rendu des fichiers avec lien téléchargement (lignes 3895-3897)
  - Upload vers Supabase Storage + envoi URL (lignes 4029-4041)

### 8. Notifications épinglées flottantes (style Messenger)
- Dans `whatsapp-chat.tsx` — **IMPLÉMENTÉ ✅**
  - `pinnedNotifications` state (ligne 302)
  - `addPinnedNotification` (ligne 1811) — ajoute icône flottante avec badge
  - `loadPinnedNotifications` (ligne 1794) — charge depuis localStorage
  - Rendu des icônes avec compteur (ligne 3578)
  - Broadcast temps réel des notifications (ligne 1972)
  - Admin peut dé-épingler pour tous (ligne 1866)

### 9. Historique des appels
- **Fichier**: `call-history.tsx` — **EXISTE** (intégré ligne 27)

### 10. Calendrier d'événements
- **Fichier**: `event-calendar.tsx` — **EXISTE** (intégré ligne 26)

### 11. Deep-link notifications → conversation
- **IMPLÉMENTÉ ✅** (cette session)
  - `notifyDirectMessage` avec `conversationId`
  - `notification-bell.tsx` → `handleNotifClick` → `setPendingNavigation`
  - `page.tsx` → `?nav=conversation&id=xxx` parsing
  - `community-view.tsx` → `pendingNavigation` → ouvre conversation

### 12. Messages vocaux
- **Fichier**: `voice-message-player.tsx` + `use-voice-recording.ts` — **IMPLÉMENTÉ ✅**

### 13. Recherche de messages
- Dans `whatsapp-chat.tsx` — **IMPLÉMENTÉ ✅** (Search dans le header)

---

## ⚠️ PROBLÈMES IDENTIFIÉS (Bugs, pas fonctionnalités manquantes)

### 1. Header de groupe — pas assez responsive
- **Statut**: Le header existe mais peut être caché par le conteneur de chat
- **Fix**: Rendre le header `sticky top-0` et le chat `flex-1 overflow-y-auto`

### 2. Boutons trop petits (outils, audio, vidéo)
- **Statut**: Les boutons existent mais sont `h-7 w-7` ou `h-8 w-8`
- **Fix**: Agrandir à `h-10 w-10` avec icônes `h-5 w-5`

### 3. Dé-épinglage de sujet de prière
- **Statut**: Le dé-épinglage des **notifications** fonctionne ✅
- **Bug possible**: Le dé-épinglage du **sujet de prière** (bandeau vert) ne fonctionne pas
- **Fix**: Ajouter un bouton ✕ sur le bandeau de prière épinglé

### 4. Bouton "Répondre à ce message" pas assez visible
- **Statut**: Le bouton existe mais est une petite icône 💬
- **Fix**: Remplacer par un bouton textuel "Répondre" plus visible

### 5. Vitesse d'ouverture des groupes
- **Statut**: `openGroup()` fait des requêtes séquentielles
- **Fix**: Utiliser `Promise.all()` et pré-charger depuis le cache

### 6. Google Meet au lieu de l'appel vidéo de groupe
- **Statut**: L'appel vidéo de groupe utilise WebRTC natif
- **Fix**: Remplacer par un lien Google Meet via l'API Calendar
- **Prérequis**: Clé API Google du user

### 7. Stockage local type WhatsApp
- **Statut**: IndexedDB PAS implémenté, tout va dans Supabase
- **Impact**: Futur, quand le nombre d'utilisateurs augmentera

---

## 📊 RÉSUMÉ

| Catégorie | Implémenté | Bugs/Améliorations |
|-----------|------------|-------------------|
| WebRTC Audio/Vidéo P2P | ✅ | — |
| Salon vocal Discord | ✅ | — |
| Outils de groupe (5+) | ✅ | Boutons trop petits |
| Sondages | ✅ | — |
| Compteur prière collectif | ✅ | — |
| Événements/Calendrier | ✅ | — |
| Épinglage | ✅ | Dé-épinglage sujet à vérifier |
| Réponse messages | ✅ | Bouton pas assez visible |
| Partage photos/fichiers | ✅ | — |
| Notifications flottantes | ✅ | — |
| Deep-link notifs | ✅ | Fait cette session |
| Messages vocaux | ✅ | — |
| Header responsive | ⚠️ | À fixer |
| Vitesse ouverture groupe | ⚠️ | À optimiser |
| Google Meet API | ❌ | À implémenter |
| Stockage IndexedDB local | ❌ | Long terme |
| Multi-appel (4 pers.) | ❌ | Architecture complexe |
