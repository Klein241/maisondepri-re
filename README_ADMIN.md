# 🙏 Prayer Marathon App - Admin Backoffice

![Admin Backoffice Structure](./admin_backoffice_structure.png)

## 📖 Vue d'ensemble

Application web moderne pour gérer un programme de jeûne et prière de 40 jours. Ce backoffice admin permet de gérer tout le contenu, les utilisateurs et la communauté.

## ✨ Fonctionnalités complètes

### 🛡️ Modération
- Gestion des témoignages avec photos
- Approbation/désapprobation des contenus
- Gestion des requêtes de prière
- Suppression de contenu inapproprié
- Badges de statut visuel

### 📁 Ressources Journalières
- Upload de médias pour chaque jour (1-40)
- Support de 5 types de ressources :
  - 📷 Images
  - 🎥 Vidéos
  - 📄 PDF
  - 🎵 Audio
  - 📝 Texte
- Activation/désactivation des ressources
- Ordre de tri personnalisable

### 🔔 Communications
- Envoi de notifications push
- Ciblage des utilisateurs :
  - Tous les utilisateurs
  - Utilisateurs actifs/inactifs
  - Par plateforme (iOS/Android)
- Historique des notifications

### 📅 Programme
- Gestion du programme des 40 jours
- Édition des contenus quotidiens
- Initialisation de la base de données

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Compte Supabase
- npm ou yarn

### Installation

1. **Cloner et installer les dépendances** :
```bash
cd prayer-marathon-app
npm install
```

2. **Configurer Supabase** :
   - Suivez le guide : [`QUICK_START.md`](./QUICK_START.md)
   - Exécutez les migrations SQL
   - Créez les buckets de stockage

3. **Configurer les variables d'environnement** :
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_clé_anon
```

4. **Lancer l'application** :
```bash
npm run dev
```

5. **Accéder au backoffice** :
```
http://localhost:3000/admin
```

## 📚 Documentation

- 📖 [**QUICK_START.md**](./QUICK_START.md) - Guide de démarrage rapide (20 min)
- 📋 [**ADMIN_BACKOFFICE_COMPLETE.md**](./ADMIN_BACKOFFICE_COMPLETE.md) - Liste complète des fonctionnalités
- 🗄️ [**SUPABASE_SETUP.md**](./SUPABASE_SETUP.md) - Configuration détaillée de Supabase
- ✅ [**verify-setup.sql**](./verify-setup.sql) - Script de vérification

## 🗄️ Structure de la base de données

### Tables principales
- `day_resources` - Ressources journalières
- `testimonials` - Témoignages avec photos
- `prayer_requests` - Requêtes de prière
- `profiles` - Profils utilisateurs
- `days` - Programme des 40 jours
- `app_notifications` - Notifications

### Buckets de stockage
- `day-resources` (50MB) - Médias des ressources
- `testimonial-photos` (10MB) - Photos des témoignages
- `avatars` (5MB) - Photos de profil

## 🛠️ Stack technique

- **Frontend** : Next.js 14+, React, TypeScript
- **Styling** : Tailwind CSS, shadcn/ui
- **Backend** : Supabase (PostgreSQL, Storage, Auth)
- **Animations** : Framer Motion
- **Notifications** : Sonner (toast)
- **Déploiement** : Netlify

## 📁 Structure du projet

```
prayer-marathon-app/
├── src/
│   ├── app/
│   │   └── admin/
│   │       ├── moderation/      # Modération des contenus
│   │       ├── resources/       # Ressources journalières
│   │       ├── notifications/   # Communications
│   │       ├── content/         # Programme
│   │       ├── users/           # Gestion utilisateurs
│   │       └── settings/        # Paramètres
│   ├── components/
│   │   ├── admin/               # Composants admin
│   │   └── community/           # Composants communauté
│   └── lib/
│       ├── supabase.ts          # Client Supabase
│       └── types.ts             # Types TypeScript
├── supabase-migrations.sql      # Migrations SQL
├── QUICK_START.md               # Guide rapide
├── SUPABASE_SETUP.md            # Setup Supabase
└── ADMIN_BACKOFFICE_COMPLETE.md # Documentation complète
```

## 🔐 Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Policies de stockage configurées
- Authentication via Supabase Auth
- Validation des fichiers (type, taille)

## 🎨 Design

- Interface moderne avec glassmorphism
- Thème sombre professionnel
- Animations fluides
- Responsive design
- Accessibilité optimisée

## 🐛 Dépannage

### Erreur "Bucket not found"
➡️ Créez les buckets dans Supabase Storage (voir `QUICK_START.md`)

### Erreur "Table does not exist"
➡️ Exécutez `supabase-migrations.sql` dans SQL Editor

### Upload ne fonctionne pas
➡️ Vérifiez les policies des buckets (voir `SUPABASE_SETUP.md`)

### Pour plus d'aide
➡️ Consultez `ADMIN_BACKOFFICE_COMPLETE.md` section Support

## 📊 Vérification de l'installation

Exécutez ce script dans Supabase SQL Editor :
```sql
-- Voir verify-setup.sql
```

## 🤝 Contribution

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est sous licence MIT.

## 👥 Auteurs

- **SYGMA-TECH** - Développement initial

## 🙏 Remerciements

- Supabase pour l'infrastructure backend
- shadcn/ui pour les composants UI
- La communauté Next.js

---

**Fait avec ❤️ pour la communauté chrétienne**

Pour toute question ou support, consultez la documentation ou ouvrez une issue.
