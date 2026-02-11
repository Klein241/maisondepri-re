-- SCRIPT DE MISE À JOUR (MIGRATION)
-- Exécutez ce script pour mettre à jour votre base de données existante.

-- 1. Ajouter la colonne 'role' à la table 'profiles' de manière sécurisée (si elle n'existe pas)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'role') then
        alter table public.profiles add column role text default 'user';
    end if;
end $$;

-- 2. Mettre à jour la fonction handle_new_user pour inclure le rôle
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 3. Créer la table 'days' si elle n'existe pas
create table if not exists public.days (
  day_number int not null primary key,
  title text not null,
  theme text,
  bible_reading jsonb, -- { reference: text, passage: text }
  prayer_focus text[],
  meditation text,
  practical_action text,
  created_at timestamptz default now()
);

-- 4. Activer la sécurité RLS sur 'days'
alter table public.days enable row level security;

-- 5. Recréer les politiques de sécurité (Policies) pour 'days'
-- On supprime les anciennes pour éviter les doublons
drop policy if exists "Public days are viewable by everyone." on public.days;
create policy "Public days are viewable by everyone." on public.days for select using ( true );

drop policy if exists "Admins can insert days." on public.days;
create policy "Admins can insert days." on public.days for insert with check ( 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admins can update days." on public.days;
create policy "Admins can update days." on public.days for update using ( 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admins can delete days." on public.days;
create policy "Admins can delete days." on public.days for delete using ( 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 6. Mise à jour manuelle de votre rôle Admin (OPTIONNEL - À exécuter si vous voulez devenir admin immédiatement)
-- Remplacez 'votre-email@example.com' par votre email réel
-- update public.profiles set role = 'admin' where email = 'votre-email@example.com';

-- 7. Ajout des colonnes pour l'authentification simplifiée (Nom, Prénom, Pays, Ville, WhatsApp)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'first_name') then
        alter table public.profiles add column first_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'last_name') then
        alter table public.profiles add column last_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'country') then
        alter table public.profiles add column country text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'city') then
        alter table public.profiles add column city text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'whatsapp') then
        alter table public.profiles add column whatsapp text;
    end if;
end $$;

-- Mise à jour de la fonction handle_new_user pour enregistrer ces nouvelles infos
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role, first_name, last_name, country, city, whatsapp)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'whatsapp'
  );
  return new;
end;
$$ language plpgsql security definer;
