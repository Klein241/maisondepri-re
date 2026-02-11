
-- Table pour le chat Realtime dans le Mur de Prière
create table if not exists public.community_messages (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

alter table public.community_messages enable row level security;

create policy "Messages are viewable by everyone." on public.community_messages for select using ( true );
create policy "Authenticated users can insert messages." on public.community_messages for insert to authenticated with check ( auth.uid() = user_id );

-- Table pour les notifications
create table if not exists public.app_notifications (
  id uuid not null default gen_random_uuid() primary key,
  title text not null,
  message text not null,
  target text default 'all', -- 'all', 'active', etc.
  created_at timestamptz default now()
);

alter table public.app_notifications enable row level security;

create policy "Notifications are viewable by everyone." on public.app_notifications for select using ( true );
create policy "Admins can insert notifications." on public.app_notifications for insert with check ( 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Paramètres de la Bible pour l'Admin
insert into public.app_settings (key, value, description)
values 
  ('bible_feature_audio', 'true', 'Activer le lecteur audio dans la Bible'),
  ('bible_feature_split_view', 'true', 'Activer le mode split-view (comparaison)'),
  ('bible_feature_offline', 'true', 'Permettre le téléchargement pour lecture hors-ligne')
on conflict (key) do nothing;
