-- Ensure generations.is_public exists for public sharing
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

