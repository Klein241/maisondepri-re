-- Création des buckets de stockage (Dossiers pour les images)
insert into storage.buckets (id, name, public)
values ('prayers', 'prayers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('testimonials', 'testimonials', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do nothing;

-- REINITIALISATION DES POLITIQUES (Pour éviter les conflits)
drop policy if exists "Public Access Prayers" on storage.objects;
drop policy if exists "Auth Upload Prayers" on storage.objects;
drop policy if exists "Public Access Testimonials" on storage.objects;
drop policy if exists "Auth Upload Testimonials" on storage.objects;
drop policy if exists "Public Access Resources" on storage.objects;
drop policy if exists "Admin Upload Resources" on storage.objects;

-- Politiques de sécurité pour 'prayers'
create policy "Public Access Prayers"
  on storage.objects for select
  using ( bucket_id = 'prayers' );

create policy "Auth Upload Prayers"
  on storage.objects for insert
  with check ( bucket_id = 'prayers' and auth.role() = 'authenticated' );

-- Politiques de sécurité pour 'testimonials'
create policy "Public Access Testimonials"
  on storage.objects for select
  using ( bucket_id = 'testimonials' );

create policy "Auth Upload Testimonials"
  on storage.objects for insert
  with check ( bucket_id = 'testimonials' and auth.role() = 'authenticated' );

-- Politiques de sécurité pour 'resources'
create policy "Public Access Resources"
  on storage.objects for select
  using ( bucket_id = 'resources' );

create policy "Admin Upload Resources"
  on storage.objects for insert
  with check ( bucket_id = 'resources' );  -- Idéalement restreindre aux admins, mais ouvert pour le test

-- Table pour les groupes de prière (Chat)
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

-- Table pour les membres des groupes
create table if not exists public.prayer_group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.prayer_groups(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'member', -- admin, moderator, member
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

-- Table pour les messages de groupe
create table if not exists public.prayer_group_messages (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.prayer_groups(id) on delete cascade,
  user_id uuid references auth.users(id),
  content text not null,
  is_prayer boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.prayer_groups enable row level security;
alter table public.prayer_group_members enable row level security;
alter table public.prayer_group_messages enable row level security;

-- Policies simplifiées pour le test
create policy "Public view groups" on public.prayer_groups for select using (true);
create policy "Auth create groups" on public.prayer_groups for insert with check (auth.role() = 'authenticated');
create policy "Members view messages" on public.prayer_group_messages for select using (true);
create policy "Members send messages" on public.prayer_group_messages for insert with check (auth.role() = 'authenticated');

-- =====================================================
-- TABLE RESSOURCES DU JOUR (Pour DayDetailView)
-- =====================================================
create table if not exists public.day_resources (
  id uuid default gen_random_uuid() primary key,
  day_number int not null,
  resource_type text not null, -- 'video', 'audio', 'image', 'text', 'pdf'
  title text not null,
  description text,
  url text,
  content text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.day_resources enable row level security;

create policy "Public view resources" 
  on public.day_resources for select 
  using (is_active = true);

create policy "Admin manage resources" 
  on public.day_resources for all 
  using (auth.role() = 'authenticated'); -- Simplifié pour le hackathon (tout user auth peut gérer)

-- =====================================================
-- TABLE TRACKING DES VUES (Pour Admin/Realtime)
-- =====================================================
create table if not exists public.day_views (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  day_number int not null,
  viewed_at timestamptz default now(),
  duration_seconds int default 0
);

alter table public.day_views enable row level security;

create policy "Users can insert own views" 
  on public.day_views for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own views" 
  on public.day_views for update 
  using (auth.uid() = user_id);

create policy "Admins can view all" 
  on public.day_views for select 
  using (true); -- Ouvert pour le dashboard admin


-- =====================================================
-- PHASE 2: MESSAGERIE PRIVÉE (DM) ET AMÉLIORATIONS
-- =====================================================

-- Table pour les conversations privées (1-to-1)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  participant1_id uuid references auth.users(id),
  participant2_id uuid references auth.users(id),
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(participant1_id, participant2_id)
);

-- Table pour les messages privés
create table if not exists public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id),
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS pour les nouvelles tables
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;

-- Policies pour les conversations
create policy "Users can view their conversations" 
  on public.conversations for select 
  using (auth.uid() = participant1_id or auth.uid() = participant2_id);

create policy "Users can create conversations" 
  on public.conversations for insert 
  with check (auth.uid() = participant1_id or auth.uid() = participant2_id);

-- Policies pour les messages privés
create policy "Users can view their messages" 
  on public.direct_messages for select 
  using (
    exists (
      select 1 from public.conversations c 
      where c.id = conversation_id 
      and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

create policy "Users can send messages" 
  on public.direct_messages for insert 
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversations c 
      where c.id = conversation_id 
      and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

-- Fonction pour créer automatiquement un groupe de prière pour chaque demande
create or replace function create_prayer_group_for_request()
returns trigger as $$
begin
  insert into public.prayer_groups (
    prayer_request_id,
    name,
    description,
    created_by,
    is_open,
    is_answered
  ) values (
    NEW.id,
    'Groupe de prière: ' || left(NEW.content, 50) || '...',
    'Groupe de prière automatique pour la demande de prière',
    NEW.user_id,
    true,
    false
  );
  
  -- Ajouter le créateur comme membre du groupe
  insert into public.prayer_group_members (group_id, user_id, role)
  select g.id, NEW.user_id, 'admin'
  from public.prayer_groups g
  where g.prayer_request_id = NEW.id;
  
  return NEW;
end;
$$ language plpgsql security definer;

-- Créer le trigger (supprimer s'il existe déjà)
drop trigger if exists auto_create_prayer_group on public.prayer_requests;

create trigger auto_create_prayer_group
  after insert on public.prayer_requests
  for each row
  execute function create_prayer_group_for_request();

-- Fonction pour marquer un groupe comme exaucé quand la prière est exaucée
create or replace function sync_prayer_group_answered()
returns trigger as $$
begin
  if NEW.is_answered = true and OLD.is_answered = false then
    update public.prayer_groups
    set is_answered = true, answered_at = now(), is_open = false
    where prayer_request_id = NEW.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger pour synchroniser le statut exaucé
drop trigger if exists sync_group_answered on public.prayer_requests;

create trigger sync_group_answered
  after update on public.prayer_requests
  for each row
  execute function sync_prayer_group_answered();

-- Fonction pour obtenir ou créer une conversation
create or replace function get_or_create_conversation(other_user_id uuid)
returns uuid as $$
declare
  conv_id uuid;
begin
  -- Chercher une conversation existante
  select id into conv_id
  from public.conversations
  where (participant1_id = auth.uid() and participant2_id = other_user_id)
     or (participant1_id = other_user_id and participant2_id = auth.uid())
  limit 1;
  
  -- Si pas trouvée, créer une nouvelle
  if conv_id is null then
    insert into public.conversations (participant1_id, participant2_id)
    values (auth.uid(), other_user_id)
    returning id into conv_id;
  end if;
  
  return conv_id;
end;
$$ language plpgsql security definer;

-- Index pour les performances
create index if not exists idx_dm_conversation on public.direct_messages(conversation_id);
create index if not exists idx_dm_created on public.direct_messages(created_at desc);
create index if not exists idx_conversations_participants on public.conversations(participant1_id, participant2_id);
create index if not exists idx_prayer_groups_request on public.prayer_groups(prayer_request_id);
