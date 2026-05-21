create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_key text primary key,
  id text,
  name text,
  email text,
  picture text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_users (
  id text primary key,
  name text not null,
  email text not null unique,
  picture text,
  password_hash text,
  provider text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_key text primary key,
  theme text not null default 'system',
  language text not null default 'id',
  model text not null default 'gemini',
  web_search_enabled boolean not null default true,
  thinking_enabled boolean not null default false,
  browser_notifications_enabled boolean not null default false,
  sound_notifications_enabled boolean not null default false,
  conversation_backup jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_users (
  user_key text primary key,
  email text,
  plan_name text not null default 'premium',
  status text not null default 'active',
  started_at timestamptz,
  expires_at timestamptz,
  confirmed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_requests (
  id bigserial primary key,
  user_key text not null,
  name text,
  email text,
  method text not null default 'qris',
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.usage_daily (
  user_key text not null,
  usage_date date not null,
  chat_count integer not null default 0,
  image_count integer not null default 0,
  primary key (user_key, usage_date)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_updated_at_idx on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id bigserial primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at asc);

create table if not exists public.chat_history (
  id text primary key,
  user_key text not null,
  conversation_id text,
  model text,
  action text,
  user_message text,
  assistant_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  target text not null default 'all',
  target_user_key text,
  title text not null,
  message text not null,
  created_by text,
  created_at timestamptz not null default now(),
  read_by text[] not null default array[]::text[]
);

create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_target_user_key_idx on public.notifications (target_user_key);

