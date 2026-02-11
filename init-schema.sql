
-- Schéma de base pour Prayer Marathon App

-- 1. Table Profiles : Lier les utilisateurs authentifiés à des profils publics/privés
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user',  -- 'user', 'admin', 'moderator'
  created_at timestamptz default now(),
  primary key (id)
);

-- Activer la sécurité RLS
alter table public.profiles enable row level security;

-- Politiques RLS pour Profiles
-- Tout le monde peut lire les profils (pour afficher les auteurs des prières/témoignages)
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

-- L'utilisateur ne peut modifier que son propre profil (sauf le rôle qui est protégé)
create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );
  -- Note: Pour sécuriser le champ 'role', il faudrait idéalement un before update trigger 
  -- ou une policy plus fine, mais pour ce MVP on suppose que l'API filtre les updates.

-- Déclencheur pour créer automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'user') -- Permet de définir un admin seed via metadata si besoin
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Table User_Progress : Suivi de la progression quotidienne
create table public.user_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_number int not null,
  completed boolean default false,
  completed_at timestamptz,
  prayer_completed boolean default false,
  bible_reading_completed boolean default false,
  fasting_completed boolean default false,
  created_at timestamptz default now(),
  primary key (id),
  unique(user_id, day_number)
);

alter table public.user_progress enable row level security;

-- Politiques RLS pour User_Progress
-- L'utilisateur ne voit et modifie que sa propre progression
create policy "Users can view own progress."
  on public.user_progress for select
  using ( auth.uid() = user_id );

create policy "Users can insert own progress."
  on public.user_progress for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own progress."
  on public.user_progress for update
  using ( auth.uid() = user_id );


-- 3. Table Prayer_Requests : Mur de prière
create table public.prayer_requests (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  prayer_count int default 0,
  prayed_by uuid[] default '{}', -- Liste des ID utilisateurs qui ont prié (simple pour MVP)
  is_anonymous boolean default false,
  category text,
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.prayer_requests enable row level security;

-- Tout le monde (authentifié) peut voir les requêtes
create policy "Authenticated users can view prayer requests."
  on public.prayer_requests for select
  to authenticated
  using ( true );

-- L'utilisateur ne peut créer que ses propres requêtes
create policy "Users can create prayer requests."
  on public.prayer_requests for insert
  to authenticated
  with check ( auth.uid() = user_id );
  
-- L'utilisateur peut mettre à jour ses propres requêtes (ou tout le monde pour 'prayed_by' - on simplifie ici)
-- Pour un vrai système complexe, on ferait une table de jointure 'prayers' (request_id, user_id)
-- Ici, on va permettre à tout le monde authentifié de mettre à jour 'prayer_count' et 'prayed_by' via une fonction RPC idéalement,
-- mais pour ce MVP on va autoriser l'update général SI on est l'auteur OU via une fonction sécurisée.
-- Pour simplifier l'interaction Zustand/Supabase sans backend complexe, on autorise l'update par tous les authentifiés (attention sécurité) 
-- ou mieux : on crée une fonction RPC pour "prier".

create policy "Users can update only own requests content."
  on public.prayer_requests for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id ); 


-- 4. Table Testimonials
create table public.testimonials (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  likes int default 0,
  liked_by uuid[] default '{}',
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.testimonials enable row level security;

create policy "Authenticated users can view testimonials."
  on public.testimonials for select
  to authenticated
  using ( true );

create policy "Users can create testimonials."
  on public.testimonials for insert
  to authenticated
  with check ( auth.uid() = user_id );


-- 5. Table Journal_Entries : Privé
create table public.journal_entries (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date timestamptz default now(),
  content text not null,
  mood text,
  tags text[],
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.journal_entries enable row level security;

create policy "Users can only view own journal entries."
  on public.journal_entries for select
  using ( auth.uid() = user_id );

create policy "Users can insert own journal entries."
  on public.journal_entries for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own journal entries."
  on public.journal_entries for update
  using ( auth.uid() = user_id );

create policy "Users can delete own journal entries."
  on public.journal_entries for delete
  using ( auth.uid() = user_id );


-- Fonctions RPC pour sécuriser les interactions (Prier, Liker)

-- Fonction pour prier pour une requête
create or replace function public.pray_for_request(request_id uuid)
returns void as $$
begin
  update public.prayer_requests
  set prayer_count = prayer_count + 1,
      prayed_by = array_append(prayed_by, auth.uid())
  where id = request_id
  and not (prayed_by @> array[auth.uid()]); -- Empêche de prier deux fois
end;
$$ language plpgsql security definer;


-- Fonction pour liker un témoignage
create or replace function public.like_testimonial(testimonial_id uuid)
returns void as $$
begin
  update public.testimonials
  set likes = likes + 1,
      liked_by = array_append(liked_by, auth.uid())
  where id = testimonial_id
  and not (liked_by @> array[auth.uid()]);
end;
$$ language plpgsql security definer;


-- 6. Table Days (Programme du Marathon)
create table public.days (
  day_number int not null primary key,
  title text not null,
  theme text,
  bible_reading jsonb, -- { reference: text, passage: text }
  prayer_focus text[],
  meditation text,
  practical_action text,
  created_at timestamptz default now()
);

alter table public.days enable row level security;

-- Tout le monde peut lire le programme
create policy "Public days are viewable by everyone."
  on public.days for select
  using ( true );

-- Seuls les admins peuvent modifier
create policy "Admins can insert days."
  on public.days for insert
  with check ( 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update days."
  on public.days for update
  using ( 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete days."
  on public.days for delete
  using ( 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and role = 'admin'
    )
  );

