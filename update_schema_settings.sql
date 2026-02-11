-- 8. Création de la table 'app_settings' pour la configuration dynamique
create table if not exists public.app_settings (
  key text not null primary key,
  value text,
  description text,
  updated_at timestamptz default now()
);

-- Active RLS sur app_settings
alter table public.app_settings enable row level security;

-- Politiques pour app_settings : Lecture pour tous (pour que l'app fonctionne), Ecriture pour admins seul
drop policy if exists "Settings are viewable by everyone." on public.app_settings;
create policy "Settings are viewable by everyone." on public.app_settings for select using ( true );

drop policy if exists "Admins can update settings." on public.app_settings;
create policy "Admins can update settings." on public.app_settings for update using ( 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admins can insert settings." on public.app_settings;
create policy "Admins can insert settings." on public.app_settings for insert with check ( 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Insertion de la clé API Bible par défaut
insert into public.app_settings (key, value, description)
values ('bible_api_key', 'caaa2c201c8bb4593aa4fea781e47974', 'Clé API pour API.Bible')
on conflict (key) do update set value = EXCLUDED.value;
