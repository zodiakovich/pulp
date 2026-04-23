create table if not exists user_badges (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  badge_id text not null,
  earned_at timestamptz default now(),
  unique(user_id, badge_id)
);

alter table user_badges enable row level security;

-- Users can read their own badges via Clerk JWT sub claim
create policy "Users see own badges" on user_badges
  for select using ((auth.jwt() ->> 'sub') = user_id);

-- Service role inserts (bypasses RLS anyway, but explicit for clarity)
create policy "Service can insert badges" on user_badges
  for insert with check (true);
