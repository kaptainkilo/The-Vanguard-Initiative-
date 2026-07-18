-- ============================================================
-- VANGUARD INITIATIVE — SUPABASE SCHEMA
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)
-- ============================================================

-- ---------- PROFILES ----------
-- Linked 1:1 to Supabase's built-in auth.users table.
-- auth.users handles email/password; this table holds game data.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  callsign text not null,
  real_name text,
  id_num text unique not null,
  join_date date not null default current_date,
  age_division text not null default 'Corps' check (age_division in ('Cadet','Junior','Corps')),
  specialization text,
  squad text default 'Alpha Cell',
  privacy text default 'Public',
  avatar_color text not null default '#FFB238',
  weekly_target int not null default 4,
  is_admin boolean not null default false,
  onboarded boolean not null default false,
  baseline jsonb,
  previous_baseline jsonb,
  current_deployment_id uuid,
  reinforcement_drops_available int not null default 0,
  mcp_at_last_reinforcement int not null default 0,
  last_seen_rank text not null default 'Recruit',
  created_at timestamptz not null default now()
);

-- ---------- CAMPAIGNS ----------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  threat text not null,
  sector text not null,
  start_date date not null default current_date,
  join_window_days int not null default 5,
  duration_days int not null default 28,
  locked_at date,
  locked_targets jsonb,
  locked_deployed_count int not null default 0,
  deployed_operator_ids uuid[] not null default '{}',
  reinforcements_used int not null default 0,
  resolved text check (resolved in ('success','failed') or resolved is null),
  created_at timestamptz not null default now()
);

-- ---------- LOCATIONS ----------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  objective text not null,
  category text not null,
  unit text not null,
  manual_target int
);

-- ---------- LOGS ----------
-- One table, discriminated by `type` — mirrors the app's existing filter-by-type pattern.
create table public.logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('protocol','campaign','habit')),
  date date not null default current_date,
  timestamp bigint not null,
  -- protocol-specific
  protocol_label text,
  exercise text,
  variant text,
  category text,
  unit text,
  sets jsonb,
  total_value numeric,
  detail text,
  -- campaign-specific
  campaign_id uuid references public.campaigns(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  amount numeric,
  source text,
  source_exercise text,
  -- habit-specific
  habit_id uuid,
  created_at timestamptz not null default now()
);

-- ---------- HABITS ----------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_date date not null default current_date
);

-- ---------- CHAT MESSAGES ----------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  is_command boolean not null default false,
  text text not null,
  timestamp bigint not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Supabase enables RLS by default on new tables — nothing is
-- readable or writable until policies explicitly allow it.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.locations enable row level security;
alter table public.logs enable row level security;
alter table public.habits enable row level security;
alter table public.chat_messages enable row level security;

-- Everyone signed in can read all profiles (roster is shared/visible), but only edit their own.
create policy "profiles are viewable by all signed-in users" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "users can update their own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "users can insert their own profile on signup" on public.profiles
  for insert with check (auth.uid() = id);

-- Campaigns/Locations: readable by everyone signed in; writable only by admins.
create policy "campaigns viewable by all" on public.campaigns
  for select using (auth.role() = 'authenticated');
create policy "campaigns writable by admins" on public.campaigns
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
create policy "locations viewable by all" on public.locations
  for select using (auth.role() = 'authenticated');
create policy "locations writable by admins" on public.locations
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Logs: everyone can read all logs (roster/AAR log is shared), but you can only write your own.
create policy "logs viewable by all" on public.logs
  for select using (auth.role() = 'authenticated');
create policy "users can insert their own logs" on public.logs
  for insert with check (auth.uid() = operator_id);

-- Habits: only visible/editable by their owner.
create policy "users manage their own habits" on public.habits
  for all using (auth.uid() = operator_id);

-- Chat: everyone signed in can read and post.
create policy "chat viewable by all" on public.chat_messages
  for select using (auth.role() = 'authenticated');
create policy "users can post chat as themselves" on public.chat_messages
  for insert with check (auth.uid() = author_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- When someone signs up via Supabase Auth, automatically create
-- their profiles row so the app doesn't need a separate insert step.
-- ============================================================

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, callsign, id_num)
  values (new.id, upper(coalesce(new.raw_user_meta_data->>'callsign', 'NEW OPERATOR')), 'VAN-' || substr(new.id::text, 1, 6));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ENABLE REALTIME (for the Comms chat tab)
-- ============================================================
alter publication supabase_realtime add table public.chat_messages;
