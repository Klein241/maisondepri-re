# 🚀 Finalisation de l'Installation

Pour terminer la mise en place des fonctionnalités de **Chat**, **Ressources** et **Tracking Temps Réel**, veuillez suivre ces étapes :

## 1. Exécuter le SQL
Copiez le contenu complet du fichier `fix_storage_and_chat.sql` et exécutez-le dans l'interface SQL de Supabase (Tableau de bord > SQL Editor).

Ou utilisez le contenu ci-dessous si le fichier n'est pas accessible :

```sql
-- Création des buckets de stockage (Dossiers pour les images)
insert into storage.buckets (id, name, public) values ('prayers', 'prayers', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('testimonials', 'testimonials', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('resources', 'resources', true) on conflict (id) do nothing;

-- Policies storage simples
create policy "Public Access Prayers" on storage.objects for select using ( bucket_id = 'prayers' );
create policy "Auth Upload Prayers" on storage.objects for insert with check ( bucket_id = 'prayers' and auth.role() = 'authenticated' );
-- (Répéter pour autres buckets si nécessaire, voir fichier sql complet)

-- PHASE 2: Tables Chat & Groupes
create table if not exists public.prayer_groups (
  id uuid default gen_random_uuid() primary key,
  prayer_request_id uuid references public.prayer_requests(id),
  name text not null,
  description text,
  created_by uuid references auth.users(id),
  is_open boolean default true,
  is_answered boolean default false,
  answered_at timestamptz,
  max_members int default 50,
  created_at timestamptz default now()
);

create table if not exists public.prayer_group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.prayer_groups(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'member',
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

create table if not exists public.prayer_group_messages (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.prayer_groups(id) on delete cascade,
  user_id uuid references auth.users(id),
  content text not null,
  is_prayer boolean default false,
  created_at timestamptz default now()
);

-- Tables Messagerie Privée
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  participant1_id uuid references auth.users(id),
  participant2_id uuid references auth.users(id),
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(participant1_id, participant2_id)
);

create table if not exists public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id),
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Tables Ressources & Tracking (CRITIQUE pour l'Admin)
create table if not exists public.day_resources (
  id uuid default gen_random_uuid() primary key,
  day_number int not null,
  resource_type text not null,
  title text not null,
  description text,
  url text,
  content text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.day_views (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  day_number int not null,
  viewed_at timestamptz default now(),
  duration_seconds int default 0
);

-- Activer RLS sur toutes les tables
alter table public.prayer_groups enable row level security;
alter table public.prayer_group_members enable row level security;
alter table public.prayer_group_messages enable row level security;
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.day_resources enable row level security;
alter table public.day_views enable row level security;

-- Policies Ouvertes (Pour démo/dev)
create policy "Public Access" on public.prayer_groups for all using (true);
create policy "Public Access Members" on public.prayer_group_members for all using (true);
create policy "Public Access Messages" on public.prayer_group_messages for all using (true);
create policy "Users convos" on public.conversations for all using (true); -- Simplifié
create policy "Users dms" on public.direct_messages for all using (true); -- Simplifié
create policy "Public resources" on public.day_resources for select using (true);
create policy "Admin resources" on public.day_resources for insert with check (true);
create policy "Tracking insert" on public.day_views for insert with check (true);
create policy "Tracking update" on public.day_views for update using (true);
create policy "Tracking select" on public.day_views for select using (true);

-- Triggers pour automatisation
create or replace function create_prayer_group_for_request() returns trigger as $$
begin
  insert into public.prayer_groups (prayer_request_id, name, description, created_by)
  values (NEW.id, 'Groupe: ' || left(NEW.content, 20), 'Groupe de prière', NEW.user_id);
  return NEW;
end;
$$ language plpgsql security definer;

create trigger auto_create_prayer_group after insert on public.prayer_requests for each row execute function create_prayer_group_for_request();
```

## 2. Peupler les données (Seed)
Une fois le SQL exécuté, lancez le script de seed pour ajouter des ressources de démonstration :

```bash
npx tsx scripts/seed-db.ts
```

Cela ajoutera des vidéos/PDFs pour les Jours 1 et 2 afin que vous puissiez tester l'interface.

## 3. Tester les Fonctionnalités
1. **Ressources** : Allez sur le Jour 1 ou 2. Vous verrez la section "Ressources du jour".
2. **Admin Realtime** : Ouvrez `/admin/realtime` dans un nouvel onglet. Naviguez dans l'appli sur une autre fenêtre. Vous verrez les événements s'afficher en direct.
3. **Chat** :
   - Créez une demande de prière -> Un groupe est créé automatiquement (Onglet Groupes).
   - Cliquez sur le groupe pour chatter.
   - Allez dans Messages (Icone bulle en haut à droite) pour les DMs.

Tout est prêt ! 🚀
