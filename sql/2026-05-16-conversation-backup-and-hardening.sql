-- Youz AI: Backup percakapan ke database + hardening dasar
-- Tanggal: 2026-05-16

-- 1) Pastikan kolom backup ada di user_settings
alter table if exists public.user_settings
  add column if not exists conversation_backup jsonb not null default '[]'::jsonb;

comment on column public.user_settings.conversation_backup is
'Backup percakapan frontend agar data tidak hilang saat localStorage dibersihkan.';

-- 2) Index sederhana untuk lookup by user_key
create index if not exists idx_user_settings_user_key
  on public.user_settings (user_key);

-- 3) (Opsional) RLS policy contoh baca/tulis lewat service role/backend
-- Sesuaikan dengan kebijakan auth proyek Anda.
