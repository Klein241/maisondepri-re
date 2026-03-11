# 🏠 Maison de Prière — Documentation Fonctionnelle Complète

> **But de ce document :** Servir de base de connaissances pour la création d'un chatbot intelligent qui gère l'intégralité de la plateforme. Ce document décrit TOUS les scénarios d'utilisation, les entités, les commandes possibles, et les flux utilisateur.

---

## 📋 Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Rôles et permissions](#3-rôles-et-permissions)
4. [Module : Authentification](#4-module--authentification)
5. [Module : Accueil (Home)](#5-module--accueil-home)
6. [Module : Programme de 40 jours](#6-module--programme-de-40-jours)
7. [Module : Bible](#7-module--bible)
8. [Module : Journal spirituel](#8-module--journal-spirituel)
9. [Module : Communauté](#9-module--communauté)
10. [Module : Groupes de prière](#10-module--groupes-de-prière)
11. [Module : Messagerie (DM)](#11-module--messagerie-dm)
12. [Module : Système d'amis](#12-module--système-damis)
13. [Module : Notifications](#13-module--notifications)
14. [Module : Jeux bibliques](#14-module--jeux-bibliques)
15. [Module : Live / Streaming](#15-module--live--streaming)
16. [Module : Profil utilisateur](#16-module--profil-utilisateur)
17. [Module : Administration](#17-module--administration)
18. [Scénarios de chatbot](#18-scénarios-de-chatbot)
19. [Commandes chatbot suggérées](#19-commandes-chatbot-suggérées)
20. [Tables Supabase](#20-tables-supabase)
21. [Flux de navigation (deep-links)](#21-flux-de-navigation-deep-links)

---

## 1. Vue d'ensemble

**Maison de Prière** est une application web progressive (PWA) communautaire chrétienne. Elle permet aux croyants de :

- Suivre un **marathon de prière de 40 jours** (prière, lecture biblique, jeûne)
- Publier et prier pour des **demandes de prière** de la communauté
- Rejoindre des **groupes de prière** avec chat, appels vocaux, et outils collaboratifs
- Lire et étudier la **Bible** (multiples versions, recherche, favoris, surligneur)
- Participer à des **jeux bibliques** (quiz, memory, mot caché, "Qui suis-je?")
- Regarder des **lives/replays** avec commentaires en temps réel
- Envoyer des **messages directs** (chat privé)
- Gérer son **profil** et ses **paramètres de notification**
- Partager des **témoignages**

**Langues :** Français (langue principale), interface bilingue possible
**Plateforme :** Web (Next.js PWA), installable sur mobile via navigateur
**Backend :** Supabase (PostgreSQL + Auth + Storage + Realtime) + Cloudflare Workers

---

## 2. Architecture technique

```
┌─────────────────────────────────────────┐
│           Frontend (Next.js PWA)         │
│  React + TypeScript + Tailwind + Framer  │
│  Zustand (state) + Supabase Realtime     │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴─────────────┐
    │                        │
    ▼                        ▼
┌─────────────┐    ┌──────────────────┐
│  Supabase   │    │ Cloudflare Worker │
│  - Auth     │    │  - Notifications  │
│  - Database │    │  - Push (VAPID)   │
│  - Storage  │    │  - Aggregation    │
│  - Realtime │    │  - Rate Limiting  │
│  - RLS      │    │  - Cron Jobs      │
└─────────────┘    └──────────────────┘
```

**Base de données :** PostgreSQL (Supabase)
**Authentification :** Supabase Auth (email/password, WhatsApp-based pseudo-email)
**Stockage fichiers :** Supabase Storage (avatars, photos)
**Temps réel :** Supabase Realtime (postgres_changes)
**Push notifications :** Cloudflare Worker + Web Push API (VAPID/RFC 8291)
**Cache/Counters :** Cloudflare KV

---

## 3. Rôles et permissions

| Rôle | Description | Permissions |
|------|-------------|-------------|
| `user` | Utilisateur standard | Publier des prières, prier pour les autres, rejoindre des groupes, envoyer des messages, jouer aux jeux |
| `moderator` | Modérateur | Tout `user` + approuver témoignages, modérer les messages |
| `admin` | Administrateur | Tout `moderator` + gérer les utilisateurs, créer des groupes officiels, gérer les lives, modifier les paramètres de l'app, voir les stats |

**Rôle de groupe :**
| Rôle | Description |
|------|-------------|
| `admin` (créateur) | Gérer les membres, approuver les demandes, supprimer le groupe, nommer des modérateurs |
| `moderator` | Modérer les messages, approuver les demandes |
| `member` | Envoyer des messages, prier, participer aux appels |

---

## 4. Module : Authentification

### Flux d'inscription
1. L'utilisateur entre : **prénom**, **nom**, **pays**, **ville**, **WhatsApp** (numéro obligatoire)
2. Le système génère un **pseudo-email** : `[numéro_nettoyé]@marathon.local`
3. L'utilisateur choisit un **mot de passe**
4. Supabase Auth crée le compte
5. Un avatar par défaut est généré via DiceBear (initiales)
6. Les **préférences de notification par défaut** sont insérées automatiquement (trigger SQL)

### Flux de connexion
1. L'utilisateur entre son **email** (ou numéro WhatsApp converti) + **mot de passe**
2. Session Supabase créée
3. Le profil complet est chargé depuis la table `profiles`
4. Les données initiales sont chargées (prières, témoignages, progression)

### Récupération de mot de passe
- Via **email de récupération** (si configuré dans le profil)
- L'utilisateur peut configurer un email de récupération dans les paramètres

### États
- `non connecté` → Peut voir les prières, témoignages, et l'accueil (lecture seule)
- `connecté` → Accès complet à toutes les fonctionnalités
- `admin` → Panneau d'administration visible dans le profil

---

## 5. Module : Accueil (Home)

L'écran d'accueil affiche :

### 5.1 En-tête
- Nom de l'utilisateur + avatar
- Cloche de notifications (badge compteur non-lus)
- Streak actuel (jours consécutifs)

### 5.2 Carte de progression
- Jour actuel du marathon (1 à 40)
- Barre de progression
- Bouton "Continuer" vers le jour en cours

### 5.3 Actions rapides
- 🙏 **Prier** → Tab communauté > Prières
- 📖 **Bible** → Tab Bible
- 🏆 **Succès** → Section achievements
- 📈 **Stats** → Résumé de progression
- 🎮 **Jeux** → Tab Jeux
- 📻 **Live** → Salon de streaming

### 5.4 Section Lives
- Affiche les **liens sociaux actifs** (YouTube, Facebook, etc.)
- Bouton pour rejoindre un **salon live** avec commentaires en temps réel
- Section **Replays** (derniers enregistrements)

### 5.5 Live Salon
- Vidéo YouTube/Facebook intégrée
- Commentaires en temps réel (Supabase Realtime)
- Réactions emoji (❤️ 🙏 🔥 👏 etc.)
- Inscription rapide pour les invités (nom, pays, téléphone)
- Réponses et fils de commentaires
- Les admins peuvent épingler des commentaires

---

## 6. Module : Programme de 40 jours

### 6.1 Structure d'un jour
Chaque jour (1 à 40) contient :
- **Titre** du jour (ex: "L'appel à la prière")
- **Thème** du jour
- **Lecture biblique** (référence + passage complet)
- **Foyers de prière** (liste de points de prière)
- **Méditation** (texte de réflexion)
- **Action pratique** (défi quotidien)

### 6.2 Suivi de progression
Pour chaque jour, l'utilisateur coche :
- ✅ Prière effectuée (`prayerCompleted`)
- ✅ Lecture biblique effectuée (`bibleReadingCompleted`)
- ✅ Jeûne effectué (`fastingCompleted`)
- 📝 Entrée de journal (optionnel)

### 6.3 Ressources additionnelles
L'administrateur peut ajouter des ressources par jour :
- 🖼️ Images
- 🎥 Vidéos
- 📄 PDF
- 📝 Textes supplémentaires
- 🔊 Audio

### 6.4 Calcul du streak
Le **streak** est le nombre de jours consécutifs complétés (de la fin vers le début).

### 6.5 Achievements / Succès
| ID | Nom | Condition |
|----|-----|-----------|
| `first-day` | Premier Pas | 1 jour complété |
| `week-warrior` | Guerrier de la Semaine | 7 jours consécutifs |
| `halfway` | Mi-Parcours | 20 jours complétés |
| `finisher` | Finisseur | 40 jours complétés |
| `prayer-warrior` | Guerrier de Prière | 10 prières faites pour les autres |
| `journal-master` | Maître Journal | 20 entrées de journal |

---

## 7. Module : Bible

### 7.1 Lecture
- **Multiple versions** : LSG (Louis Segond), NEG, S21, BDS, King James, etc.
- **Navigation** par livre > chapitre > verset
- **Verset du jour** (affiché sur l'accueil)
- **Vue en parallèle** (split view avec 2 versions côte à côte)

### 7.2 Recherche
- Recherche textuelle dans toute la Bible
- Résultats avec référence, texte, et contexte
- Filtrage par testament (AT/NT)

### 7.3 Surlignage et favoris
- **Surligner** des versets avec choix de couleur
- **Mettre en favori** des versets (sauvegardés localement)
- Les favoris sont persistés dans Zustand (localStorage)

### 7.4 Mode hors-ligne
- Possibilité de télécharger une version complète pour lecture offline
- Paramètre `offlineMode` activable

---

## 8. Module : Journal spirituel

### 8.1 Écriture
- L'utilisateur écrit une entrée libre chaque jour
- Choix d'une **humeur** :
  - 😊 Joyeux (`joyful`)
  - ☮ Paisible (`peaceful`)
  - 🙏 Reconnaissant (`grateful`)
  - 🌟 Plein d'espoir (`hopeful`)
  - 🤔 Réflexif (`reflective`)
  - 💪 En lutte (`struggling`)
- Tags optionnels

### 8.2 Historique
- Liste chronologique des entrées
- Peut relire ses anciennes entrées

---

## 9. Module : Communauté

La communauté est l'espace social de l'application, organisé en **3 sous-onglets** :

### 9.1 Onglet Prières (`prieres`)

#### Publier une demande de prière
- Contenu textuel (obligatoire)
- Choix d'une **catégorie** :
  - 🏥 Guérison | 👨‍👩‍👧‍👦 Famille | 💰 Provision | 🧭 Direction
  - 🙏 Spirituel | 💼 Travail | 💕 Relations | 🛡️ Protection
  - 🙌 Action de grâce | ✨ Autre
- Option **Anonyme** (le nom est masqué)
- **Photos** (optionnel, jusqu'à 3 images)

#### Prier pour une demande
- Bouton 🙏 "J'ai prié" sur chaque carte
- Incrémente le compteur de prières
- Un utilisateur ne peut prier qu'**une seule fois** par demande
- **Notifications** envoyées au propriétaire et aux amis

#### Prière exaucée
- Le propriétaire peut marquer sa prière comme **exaucée**
- La prière reste visible 24h après marquage, puis se verrouille
- Badge doré "Exaucée" visible par tous

#### Commentaires sur les prières
- Les utilisateurs peuvent **commenter** sous une demande de prière
- Fils de commentaires (réponses)
- Notification envoyée au propriétaire et aux autres commentateurs

### 9.2 Onglet Témoignages (`temoignages`)

#### Publier un témoignage
- Contenu textuel (obligatoire)
- Photos optionnelles
- Soumis à **approbation** (visible uniquement après validation par un admin)

#### Interagir avec un témoignage
- Bouton ❤️ "J'aime" (un like par témoignage par utilisateur)
- Compteur de likes visible

### 9.3 Onglet Chat communautaire (`chat`)

- **Chat global** visible par tous les membres
- Messages en temps réel (Supabase Realtime)
- Affichage du nom + avatar de l'expéditeur
- Messages vocaux (enregistrement et lecture)

---

## 10. Module : Groupes de prière

### 10.1 Créer un groupe
- Nom du groupe (obligatoire)
- Description (optionnel)
- **Public** ou **privé** (nécessite approbation pour rejoindre)
- Nombre maximum de membres (défaut: 50)
- Le créateur devient automatiquement **admin du groupe**

### 10.2 Rejoindre un groupe
- **Groupe ouvert** : Rejoindre directement
- **Groupe fermé** : Envoyer une **demande d'accès**
  - L'admin reçoit une notification
  - L'admin approuve ou rejette
  - L'utilisateur est notifié du résultat

### 10.3 Chat de groupe
- Messages texte en temps réel
- Messages vocaux
- Messages de prière (marqués spécialement avec bouton 🙏)
- **@mentions** d'utilisateurs → notification push
- Réactions emoji sur les messages
- Réponses en fil (threading)

### 10.4 Outils de groupe
- **Sondages** : Créer des sondages avec options multiples
- **Événements/Calendrier** : Planifier des événements de prière
- **Compteur de prières** : Suivi collectif des prières du groupe
- **Programme de jeûne** : Programme personnalisé créé par l'admin

### 10.5 Appels vocaux de groupe
- **Appels de groupe** via WebRTC
- Bouton "Rejoindre l'appel" visible dans le groupe
- Liste des participants visibles
- Micro muet/activé
- Historique des appels

### 10.6 Administration du groupe
- Approuver/rejeter les demandes d'adhésion
- Nommer des modérateurs
- Exclure des membres
- Supprimer le groupe
- Migrer les membres vers un autre groupe
- Marquer la prière liée comme exaucée

---

## 11. Module : Messagerie (DM)

### 11.1 Conversations
- Liste de toutes les conversations privées
- Dernier message affiché en aperçu
- Indicateur de messages non-lus
- Tri par dernière activité

### 11.2 Chat privé
- Interface similaire à WhatsApp
- Messages texte en temps réel
- Messages vocaux
- Indicateur "lu" / "non-lu"
- Notifications push pour nouveaux messages

### 11.3 Démarrer une conversation
- Depuis le profil d'un utilisateur
- Depuis la liste d'amis
- Fonction `get_or_create_conversation` (si conversation existe déjà, ouvre l'existante)

---

## 12. Module : Système d'amis

### 12.1 Envoyer une demande d'ami
- Depuis le profil d'un autre utilisateur
- Notification envoyée au destinataire

### 12.2 Accepter / Refuser
- Section "Demandes d'ami" dans le profil
- Accepter → les deux deviennent amis
- Refuser → la demande est supprimée. Notification envoyée à l'expéditeur.

### 12.3 Effets de l'amitié
- Les amis voient quand l'autre prie pour un sujet (`friend_prayed`)
- Accès facilité aux DMs
- Visibilité sur la présence en ligne (point vert)

---

## 13. Module : Notifications

### 13.1 Types de notifications

| Code | Événement | Exemple de message | Priorité |
|------|-----------|-------------------|----------|
| `prayer_prayed` | Quelqu'un a prié pour votre demande | "Pierre a prié pour votre demande : Guérison…" | high |
| `friend_prayed` | Un ami a prié pour un sujet | "Votre ami Marie a aussi prié pour ce sujet" | low |
| `new_prayer_published` | Nouvelle demande de prière | "Jean a publié une nouvelle demande" | low |
| `prayer_comment` | Commentaire sur votre prière | "Paul a commenté votre demande" | medium |
| `prayer_no_response` | Votre prière n'a pas de réponse (48h) | "Votre demande attend encore…" | medium |
| `group_access_request` | Demande de rejoindre votre groupe | "Marie souhaite rejoindre votre groupe" | high |
| `group_access_approved` | Votre demande approuvée | "Votre accès au groupe a été approuvé !" | medium |
| `group_new_message` | Nouveau message dans un groupe | "Pierre: Bonjour à tous…" | medium |
| `admin_new_group` | Nouveau groupe officiel | "Nouveau groupe : Intercesseurs" | low |
| `group_invitation` | Invitation à un groupe | "Marie vous invite à rejoindre…" | high |
| `group_mention` | @mention dans un groupe | "Pierre vous a mentionné dans…" | high |
| `dm_new_message` | Message privé | "Marie: Salut, comment vas-tu ?" | high |
| `friend_request_received` | Demande d'ami reçue | "Pierre vous a envoyé une demande d'ami" | medium |
| `friend_request_accepted` | Ami accepté | "Marie a accepté votre demande" | low |

### 13.2 Canaux de notification
- **In-app** : Centre de notifications (cloche avec badge)
- **Push** : Web Push (Service Worker + VAPID)
- **Son** : Notification sonore à réception
- **Système** : Notification navigateur (quand l'app est en arrière-plan)

### 13.3 Préférences
Chaque type de notification peut être activé/désactivé individuellement :
- Toggle **In-app** (notification dans le centre)
- Toggle **Push** (notification système même quand l'app est fermée)

### 13.4 Agrégation
Les notifications similaires sont agrégées :
- "Pierre, Marie et 3 autres ont prié pour votre demande"
- Fenêtre d'agrégation : 30 min pour les prières, 5 min pour les messages

### 13.5 Deep-linking
Chaque notification contient des données de navigation permettant d'aller directement au contenu concerné (prière, groupe, conversation, etc.).

---

## 14. Module : Jeux bibliques

### 14.1 Jeux disponibles

| Jeu | Description | Mode |
|-----|-------------|------|
| **Quiz biblique** | QCM sur les versets et histoires bibliques | Solo |
| **Bible Memory** | Jeu de mémoire avec cartes de versets | Solo |
| **Mot caché** | Trouver des mots bibliques dans une grille | Solo |

| **Qui suis-je ?** | Deviner un personnage biblique avec des indices | Solo |
| **Quiz Duel** | Affrontement en temps réel contre un autre joueur | Multijoueur |
| **Chrono Game** | Ordonner des événements bibliques chronologiquement | Solo |

### 14.2 Système de score
- Score par partie
- Score maximum par partie
- Temps de complétion
- Difficulté : `easy` / `medium` / `hard`

### 14.3 Classement (Leaderboard)
- Score total cumulé
- Nombre de parties jouées
- Score moyen
- Rang dans la communauté

### 14.4 Multijoueur
- **Lobby** : Créer/rejoindre une salle de jeu
- Matchmaking en temps réel
- Résultats comparés en fin de partie

---

## 15. Module : Live / Streaming

### 15.1 Salon live
- Intégration vidéo YouTube / Facebook
- Autoplay en mode muet (puis unmute au clic)
- URL de backup si le stream principal échoue

### 15.2 Commentaires live
- Chat en temps réel pendant le live
- Réactions emoji flottantes (animation)
- Commentaires épinglés par les admins
- Réponses en fil
- Suppression de ses propres commentaires

### 15.3 Replays
- Liste des anciens lives
- Lecture vidéo avec commentaires archivés

### 15.4 Inscription invité
Pour les non-inscrits qui veulent commenter :
- Formulaire rapide : nom, pays, téléphone
- Accès temporaire au chat du live

---

## 16. Module : Profil utilisateur

### 16.1 Informations éditables
- **Avatar** (upload photo avec crop)
- **Nom complet**
- **Numéro WhatsApp**
- **Email de récupération** (optionnel, pour reset mot de passe)
- **Ville, Pays**

### 16.2 Sécurité
- **Changer de mot de passe**
- **Mot de passe oublié** → envoi d'email de reset

### 16.3 Gestion des groupes
- Liste de ses groupes avec rôle
- Accès rapide à l'administration de chaque groupe
- Migration de membres entre groupes

### 16.4 Dashboard administrateur (si role = admin)
- **Stats globales** :
  - Nombre total d'utilisateurs
  - Utilisateurs actifs
  - Total de prières / prières exaucées
  - Total de témoignages
  - Progression moyenne du marathon
- **Gestion des contenu** :
  - Approuver/rejeter les témoignages
  - Approuver/rejeter les prières
  - Gérer les ressources par jour
  - Modifier les liens sociaux (lives)
- **Gestion des utilisateurs** :
  - Changer le rôle d'un utilisateur
  - Bannir un utilisateur

### 16.5 Présence en ligne
- Indicateur **en ligne** (point vert sur l'avatar)
- **Dernière connexion** (`last_seen`)
- Mise à jour automatique toutes les X secondes

---

## 17. Module : Administration

### 17.1 Paramètres de l'app (`app_settings`)
Table clé-valeur pour configurer l'app globalement :
- URL du worker de notifications
- URL du live actif
- Texte d'annonce global
- Activation/désactivation de fonctionnalités

### 17.2 Approbation de contenu
- Les témoignages doivent être approuvés avant publication
- Les demandes de prière peuvent nécessiter approbation (`is_approved`)

### 17.3 Broadcast
- Envoi d'une notification à **tous les utilisateurs** (annonces)
- Fonction SQL `broadcast_notification(titre, message, type)`

---

## 18. Scénarios de chatbot

Voici les scénarios que le chatbot devra gérer, organisés par catégorie :

### 🔐 Authentification
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Je veux m'inscrire" | Démarrer le flux d'inscription (demander prénom, nom, pays, WhatsApp, mot de passe) |
| "J'ai oublié mon mot de passe" | Vérifier s'il y a un email de récupération, envoyer le lien |
| "Changer mon mot de passe" | Demander l'ancien et le nouveau mot de passe |
| "Me déconnecter" | Déconnecter la session |

### 🙏 Prières
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Publier une prière" | Demander le contenu, la catégorie, et si c'est anonyme |
| "Montrer les demandes de prière" | Afficher les dernières prières avec bouton "prier" |
| "Prier pour [nom/ID]" | Exécuter `prayForRequest` |
| "Mes prières" | Filtrer et afficher les prières de l'utilisateur |
| "Marquer ma prière comme exaucée" | Marquer `is_answered = true` |
| "Combien de personnes ont prié pour moi ?" | Retourner `prayer_count` de ses prières |

### 👥 Groupes
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Créer un groupe" | Demander nom, description, public/privé |
| "Rejoindre [nom du groupe]" | Chercher le groupe et envoyer une demande ou rejoindre directement |
| "Mes groupes" | Lister les groupes de l'utilisateur avec rôle |
| "Qui est dans le groupe [X] ?" | Lister les membres |
| "Envoyer un message dans [groupe]" | Poster un message dans le chat du groupe |
| "Approuver [nom] dans mon groupe" | Approuver la demande d'accès |
| "Exclure [nom] du groupe [X]" | Retirer le membre |

### 💬 Messages
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Envoyer un message à [nom]" | Ouvrir ou créer la conversation, demander le message |
| "Mes conversations" | Lister les conversations avec dernier message |
| "Messages non-lus" | Afficher le nombre de messages non-lus |

### 📖 Bible
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Lire [Référence]" | Ex: "Lire Jean 3:16" → Afficher le verset |
| "Verset du jour" | Afficher le verset quotidien |
| "Chercher [mot] dans la Bible" | Recherche textuelle |
| "Mes versets favoris" | Liste des favoris |

### 🎮 Jeux
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Jouer au quiz" | Lancer le quiz biblique |
| "Mon score" | Afficher les stats de jeu |
| "Classement" | Afficher le leaderboard |

### 🔔 Notifications
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Mes notifications" | Lister les notifications récentes |
| "Tout marquer lu" | Marquer toutes les notifications comme lues |
| "Désactiver les notifications de [type]" | Modifier les préférences |
| "Combien de notifications non-lues ?" | Retourner le count |

### 📊 Progression
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Ma progression" | Afficher jour actuel, streak, jours complétés |
| "Valider le jour [N]" | Marquer les 3 activités comme complétées |
| "Mon streak" | Afficher le nombre de jours consécutifs |
| "Mes succès" | Lister les achievements débloqués |

### 👤 Profil / Social
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Mon profil" | Afficher les infos du profil |
| "Changer mon nom" | Mettre à jour `full_name` |
| "Changer mon avatar" | Upload de photo |
| "Ajouter [nom] en ami" | Envoyer demande d'ami |
| "Mes amis" | Lister les amis acceptés |
| "Qui est en ligne ?" | Lister les utilisateurs en ligne |

### 🛡️ Administration (admin seulement)
| Commande utilisateur | Action chatbot |
|---------------------|---------------|
| "Stats de la plateforme" | Afficher les AdminStats |
| "Approuver le témoignage [ID]" | Approuver |
| "Bannir [utilisateur]" | Changer le rôle ou supprimer |
| "Envoyer une annonce" | Broadcast notification à tous |
| "Qui sont les admins ?" | Lister les admins |

---

## 19. Commandes chatbot suggérées

Pour un chatbot de type Telegram/Discord, voici les commandes slash :

```
/start          — Démarrer le bot, voir le menu
/inscription    — S'inscrire sur la plateforme
/connexion      — Se connecter
/profil         — Voir son profil
/progression    — Voir sa progression du marathon
/streak         — Voir son streak
/jour [N]       — Détails du jour N du programme
/prier          — Publier une demande de prière
/prieres        — Voir les demandes de prière récentes
/groupes        — Mes groupes
/rejoindre [G]  — Rejoindre un groupe
/creergroupe    — Créer un nouveau groupe
/message [nom]  — Envoyer un message à quelqu'un
/conversations  — Voir mes conversations
/bible [ref]    — Lire un passage biblique
/verset         — Verset du jour
/recherche [mot]— Chercher dans la Bible
/quiz           — Jouer au quiz biblique
/classement     — Voir le leaderboard
/notifs         — Mes notifications
/toutvlu        — Marquer tout comme lu
/parametres     — Paramètres de notification
/amis           — Liste d'amis
/ajouterami [N] — Envoyer une demande d'ami
/aide           — Liste des commandes
/admin          — Commandes d'admin (si admin)
```

---

## 20. Tables Supabase

| Table | Description | Clés principales |
|-------|-------------|-----------------|
| `profiles` | Profils utilisateur | `id` (= auth.users.id), `full_name`, `avatar_url`, `role`, `is_online`, `last_seen` |
| `prayer_requests` | Demandes de prière | `id`, `user_id`, `content`, `category`, `is_anonymous`, `prayer_count`, `prayed_by[]`, `is_answered` |
| `prayer_comments` | Commentaires sur les prières | `id`, `prayer_id`, `user_id`, `content`, `parent_id` |
| `testimonials` | Témoignages | `id`, `user_id`, `content`, `is_approved`, `likes`, `liked_by[]` |
| `prayer_groups` | Groupes de prière | `id`, `name`, `description`, `created_by`, `is_open`, `requires_approval`, `max_members` |
| `prayer_group_members` | Membres des groupes | `group_id`, `user_id`, `role` |
| `prayer_group_messages` | Messages de groupe | `id`, `group_id`, `user_id`, `content`, `is_prayer` |
| `prayer_group_join_requests` | Demandes d'adhésion | `id`, `group_id`, `user_id`, `status` |
| `community_messages` | Chat communautaire global | `id`, `user_id`, `content` |
| `conversations` | Conversations privées | `id`, `participant1_id`, `participant2_id`, `last_message_at` |
| `direct_messages` | Messages directs | `id`, `conversation_id`, `sender_id`, `content`, `is_read` |
| `friendships` | Relations d'amitié | `sender_id`, `receiver_id`, `status` |
| `notifications` | Notifications | `id`, `user_id`, `title`, `message`, `type`, `action_type`, `action_data`, `actors`, `is_read`, `priority` |
| `notification_preferences` | Préférences de notification | `user_id`, `action_type`, `in_app`, `push_enabled` |
| `push_tokens` | Tokens push (Web Push) | `user_id`, `subscription_json`, `platform` |
| `user_progress` | Progression du marathon | `user_id`, `day_number`, `completed`, `prayer_completed`, `bible_reading_completed` |
| `app_settings` | Paramètres globaux de l'app | `key`, `value` |
| `social_links` | Liens sociaux (lives, YouTube) | `id`, `platform`, `title`, `url` |

---

## 21. Flux de navigation (deep-links)

Le chatbot doit pouvoir naviguer l'utilisateur vers les bonnes sections :

| Action | Deep-link data |
|--------|---------------|
| Voir une prière | `{ tab: 'community', communityTab: 'prieres', prayerId: '...' }` |
| Ouvrir un groupe | `{ tab: 'community', viewState: 'group-detail', groupId: '...', groupName: '...' }` |
| Ouvrir le chat d'un groupe | `{ tab: 'community', viewState: 'group-detail', groupId: '...', communityTab: 'chat' }` |
| Ouvrir une conversation DM | `{ tab: 'community', communityTab: 'chat', viewState: 'conversation', conversationId: '...' }` |
| Voir les demandes d'ami | `{ tab: 'profil', viewState: 'friend-requests' }` |
| Liste des groupes | `{ tab: 'community', viewState: 'groups' }` |
| Ouvrir la Bible | `{ tab: 'bible' }` |
| Voir les jeux | `{ tab: 'games' }` |
| Voir le programme | `{ tab: 'program' }` |
| Voir le journal | `{ tab: 'journal' }` |

---

## Annexe : Variables d'environnement

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...

# Cloudflare Notification Worker
NEXT_PUBLIC_NOTIFICATION_WORKER_URL=https://maisondepriere-notifications.xxx.workers.dev

# VAPID (Push Notifications)
NEXT_PUBLIC_VAPID_KEY=BK...
```

---

> **Ce document est la référence complète pour le chatbot.** Toute commande utilisateur doit pouvoir être mappée à un scénario décrit ci-dessus, avec les bonnes données d'action et les bons appels API.
