-- ─────────────────────────────────────────────────────────────────────────────
-- Note attachments: store uploaded file metadata on each note.
-- Files themselves live in the existing `taskr-attachments` storage bucket under
-- notes/<noteId>/…; this column just holds the [{id,name,size,type,path,url,ts}] list.
-- Run once in the Supabase SQL editor. (The app degrades gracefully without it —
-- attachments just won't persist until this is applied.)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notes
  add column if not exists attachments jsonb not null default '[]'::jsonb;
