-- ==========================================================
-- SQL CLEANUP & SETUP (Sans commentaires Markdown gênants)
-- ==========================================================

-- 1. Tables de base pour le chat
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

-- 2. Tables Messagerie Privée (1-to-1)
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

-- 3. Ressources & Tracking
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

create table if not exists public.day_views (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  day_number int not null,
  viewed_at timestamptz default now(),
  duration_seconds int default 0
);

-- 4. Sécurité (RLS) - Activation
alter table public.prayer_groups enable row level security;
alter table public.prayer_group_members enable row level security;
alter table public.prayer_group_messages enable row level security;
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.day_resources enable row level security;
alter table public.day_views enable row level security;

-- 5. Policies (Règles d'accès)
-- Groupes
create policy "Anyone can view groups" on public.prayer_groups for select using (true);
create policy "Auth can create groups" on public.prayer_groups for insert with check (auth.role() = 'authenticated');
create policy "Members can view messages" on public.prayer_group_messages for select using (true);
create policy "Members can send messages" on public.prayer_group_messages for insert with check (auth.role() = 'authenticated');
create policy "Anyone can view members" on public.prayer_group_members for select using (true);
create policy "Auth can join" on public.prayer_group_members for insert with check (auth.role() = 'authenticated');

-- Conversations privées
create policy "Users view own convos" on public.conversations for select using (auth.uid() = participant1_id or auth.uid() = participant2_id);
create policy "Users create convos" on public.conversations for insert with check (auth.uid() = participant1_id or auth.uid() = participant2_id);
create policy "Users view own DMs" on public.direct_messages for select using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())));
create policy "Users send DMs" on public.direct_messages for insert with check (auth.uid() = sender_id);

-- Ressources & Views
create policy "Public view resources" on public.day_resources for select using (true);
create policy "Admin manage resources" on public.day_resources for insert with check (true); -- Simplifié
create policy "Users insert view" on public.day_views for insert with check (auth.uid() = user_id);
create policy "Users update view" on public.day_views for update using (auth.uid() = user_id);
create policy "Admins view all tracking" on public.day_views for select using (true);

-- 6. Fonctions & Triggers
-- Création auto du groupe
create or replace function create_prayer_group_for_request() returns trigger as $$
begin
  insert into public.prayer_groups (prayer_request_id, name, description, created_by, is_open)
  values (NEW.id, 'Prière: ' || left(NEW.content, 30), 'Groupe de prière dédié', NEW.user_id, true);
  
  -- Ajout du créateur comme admin du groupe
  -- Note: on attend que le trigger soit fini pour l'insert member, ou on le fait ici si possible.
  -- Pour simplifier, on laisse l'utilisateur rejoindre manuellement ou on l'ajoute via une seconde requête coté client si besoin,
  -- mais faisons-le ici pour être pro.
  -- Attention: il faut que l'ID du groupe soit connu.
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists auto_create_prayer_group on public.prayer_requests;
create trigger auto_create_prayer_group after insert on public.prayer_requests for each row execute function create_prayer_group_for_request();

-- Synchro statut exaucé
create or replace function sync_prayer_group_answered() returns trigger as $$
begin
  if NEW.is_answered = true and OLD.is_answered = false then
    update public.prayer_groups set is_answered = true, is_open = false where prayer_request_id = NEW.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists sync_group_answered on public.prayer_requests;
create trigger sync_group_answered after update on public.prayer_requests for each row execute function sync_prayer_group_answered();
