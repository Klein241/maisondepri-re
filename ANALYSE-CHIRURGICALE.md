# 🔬 ANALYSE CHIRURGICALE — Maison de Prière v1.4
*Date: 4 mars 2026*

---

## 🔴 FONCTIONNALITÉS DYSFONCTIONNELLES (BUGS)

### 1. ❌ Jeu Labyrinthe 3D/2D — NE FONCTIONNE PAS
- **Fichier**: `src/components/games/labyrinth-game.tsx`
- **Bug**: Le jeu utilise `h-full` mais le conteneur parent dans `games-view.tsx` n'a pas de hauteur fixe → le canvas a 0px de hauteur sur mobile
- **Bug 2**: La boucle de rendu utilise `t` (timestamp RAF) = OK mais le D-Pad tactile perd le focus car `onTouchEnd` ne fonctionne pas correctement quand le doigt glisse hors du bouton
- **Fix requis**: Utiliser `h-[100dvh]` + `fixed inset-0` pour le mode jeu, et gérer correctement les événements touch

### 2. ⚠️ Bouton "Jeux Bibliques" dans Communauté pointe vers Bible view
- **Fichier**: `community-view.tsx:617`
- **Code**: `setBibleViewTarget('games'); setGlobalActiveTab('bible');`
- **Problème**: Redirige vers l'onglet Bible au lieu du nouvel onglet Games dédié
- **Fix**: Changer pour `setGlobalActiveTab('games')`

### 3. ⚠️ Badge demandes d'amitié — ABSENT de la page Communauté
- **Fichier**: `community-view.tsx:589-596`
- **Problème**: Le bouton "Retrouver vos amis" n'a AUCUN badge indiquant les demandes en attente. L'utilisateur ne sait pas qu'il a reçu des demandes.
- **Le composant FriendSystem** (`friend-system.tsx`) a `loadReceivedRequests()` mais aucun compteur n'est exposé à la vue parent.

### 4. ⚠️ Formulaire prière — Pas de champ "Objet"
- **Fichier**: `community-view.tsx:894-906`
- **Problème**: Le formulaire n'a que Catégorie + Textarea. Il manque un champ "Objet de la requête" qui devrait s'afficher en gras dans le feed.
- **Impact**: Les demandes n'ont pas de titre visible → difficile à scanner dans le feed

### 5. ⚠️ Notifications Push — Système basique, pas Facebook-style
- **Fichier**: `cloudflare-worker/src/index.js`
- **État actuel**: Le worker envoie des notifs simples (titre + message). Il n'y a pas de:
  - Groupement de notifications ("3 personnes ont prié pour vous")
  - Actions interactives dans la notif
  - Son personnalisé
  - Badges compteurs sur l'icône app
  - Notification en temps réel in-app (seulement via polling)

---

## 🟡 COMPOSANTS DÉVELOPPÉS MAIS NON INTÉGRÉS/PARTIELS

### 6. 📦 `quiz-duel-game.tsx` — Existant mais accès limité
- Le composant existe mais n'est pas dans `games-view.tsx` comme option directe (accessible via MultiplayerManager uniquement)

### 7. 📦 `multiplayer-lobby.tsx` — Existant, usage limité
- Lobby multijoueur construit mais la connexion temps réel dépend de Supabase Realtime → non testé offline

### 8. 📦 `call-system.tsx` + `webrtc-call.tsx` — Appels WebRTC
- Système d'appels vidéo/audio construit
- Dépend de signaling Supabase → pas de STUN/TURN configuré → ne fonctionne pas en pratique entre réseaux différents

### 9. 📦 `group-call-manager.tsx` — Appels de groupe
- Construit mais non testé en conditions réelles
- Dépend de WebRTC multi-peer → complexe sans serveur média

### 10. 📦 `livestream-salon.tsx` — Livestream
- Bouton LiveStream dans le header mais dépend de `appSettings['live_stream_active']`
- L'admin doit activer manuellement

### 11. 📦 `voice-salon.tsx` — Salon vocal
- Salon vocal style Clubhouse construit
- Dépend de WebRTC → même problème que les appels

### 12. 📦 `achievement-badge.tsx` — Badges de réussite
- Système d'achievements dans le store
- Le composant existe MAIS n'est affiché nulle part dans le profil

### 13. 📦 `event-calendar.tsx` — Calendrier d'événements
- Le bouton EventCalendarButton est dans community-view (`<EventCalendarButton />` ligne 613)
- Le composant charge les événements depuis Supabase
- Fonctionnel MAIS pas de page dédiée

### 14. 📦 `enhanced-prayer-card.tsx` — Carte de prière enrichie
- Existe mais `prayer-card.tsx` est utilisé à la place dans community-view
- Fonctionnalités avancées non utilisées

### 15. 📦 `game-progression.ts` — Système de progression
- Système de niveaux et XP construit dans lib
- NON connecté à l'interface → pas de barre de progression visible

### 16. 📦 4 fichiers Bible data — Redondance
- `local-bible-data.ts`, `local-bible-games.ts`, `local-bible-service.ts`, `french-bible-data.ts`
- Multiples sources de données Bible → confusion possible

### 17. 📦 `admin/games-manager.tsx` — Admin des jeux
- Panel admin pour gérer les jeux construit
- Accessible via /admin/content

---

## 🟢 FONCTIONNALITÉS QUI MARCHENT

| Feature | Fichier | Status |
|---------|---------|--------|
| Auth (login/signup) | auth-view.tsx + store.ts | ✅ |
| Feed prières | community-view.tsx | ✅ |
| Feed témoignages | community-view.tsx | ✅ |
| Groupes de prière | prayer-group-manager.tsx | ✅ |
| Chat WhatsApp-style | whatsapp-chat.tsx | ✅ |
| Bible (lecture) | bible-view.tsx | ✅ |
| Quiz biblique solo | bible-quiz.tsx | ✅ |
| Memory biblique | bible-memory-game.tsx | ✅ |
| Mots cachés | word-search-game.tsx | ✅ |
| Chronologie | chrono-game.tsx | ✅ |
| Qui suis-je | who-am-i-game.tsx | ✅ |
| Profil | profile-view.tsx | ✅ |
| Journal | journal-view.tsx | ✅ |
| Programme 40 jours | program-view.tsx | ✅ |
| Notification bell | notification-bell.tsx | ✅ |
| PWA install | pwa-manager.tsx | ✅ |
| Push notifications (basique) | push-notification-manager.tsx | ✅ |
| Friend system UI | friend-system.tsx | ✅ |
| Amis: messages privés | whatsapp-chat.tsx | ✅ |
| Bottom nav (5 tabs) | bottom-nav.tsx | ✅ |
| Page Games dédiée | games-view.tsx | ✅ |
| Admin panel | /admin/* | ✅ |

---

## 📋 PLAN D'ACTION PRIORITAIRE

### Priorité 1 — Fix immédiat
1. ✅ Corriger le labyrinthe 2D (hauteur + touch controls)
2. ✅ Ajouter champ "Objet" aux demandes de prière
3. ✅ Badge demandes d'amitié dans bouton Communauté
4. ✅ Rediriger bouton "Jeux Bibliques" vers l'onglet Games

### Priorité 2 — Notifications Facebook-style
5. Configurer Cloudflare Worker pour notifications groupées
6. Actions dans les notifications (Prier, Répondre)
7. Badge compteur sur icône app

### Priorité 3 — Build APK
8. Configurer Gradle avec bonne version JDK
9. Générer debug APK
10. Signer pour Play Store
