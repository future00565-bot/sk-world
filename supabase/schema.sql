-- SK World — Complete Supabase PostgreSQL Schema, RLS Policies, Realtime & Storage Setup
-- Run this script in Supabase Dashboard -> SQL Editor for project hjkwzsizfeeyelsxbwto.

create extension if not exists "pgcrypto";

-- 1. Public User Profiles (PII isolated in user_private_info)
create table if not exists public.users (
  uid uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  full_name text not null check (char_length(full_name) between 1 and 80),
  bio text default '' check (char_length(bio) <= 300),
  avatar_url text default '',
  cover_url text default '',
  location text default '' check (char_length(location) <= 100),
  website text default '' check (char_length(website) <= 200),
  is_private boolean not null default false,
  is_verified boolean not null default false,
  membership_tier text not null default 'free' check (membership_tier in ('free', 'premium', 'creator_pro')),
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  followers_count integer not null default 0 check (followers_count >= 0),
  following_count integer not null default 0 check (following_count >= 0),
  friends_count integer not null default 0 check (friends_count >= 0),
  posts_count integer not null default 0 check (posts_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Private PII & Preferences
create table if not exists public.user_private_info (
  uid uuid primary key references public.users(uid) on delete cascade,
  email text not null,
  phone text default '',
  date_of_birth text default '',
  allow_messages_from text not null default 'everyone' check (allow_messages_from in ('everyone', 'followers', 'friends')),
  show_last_seen boolean not null default true,
  language text not null default 'en' check (language in ('en', 'bn')),
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  terms_accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 3. Admins RBAC
create table if not exists public.admins (
  uid uuid primary key references public.users(uid) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'moderator', 'support')),
  assigned_by uuid references public.users(uid),
  created_at timestamptz not null default now()
);

-- 4. Groups & Communities
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text default '' check (char_length(description) <= 600),
  cover_url text default '',
  category text default 'Community',
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  creator_id uuid not null references public.users(uid) on delete cascade,
  members_count integer not null default 1 check (members_count >= 0),
  posts_count integer not null default 0 check (posts_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  uid uuid not null references public.users(uid) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, uid)
);

-- 5. Posts, Likes & Comments
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(uid) on delete cascade,
  content text not null default '' check (char_length(content) <= 5000),
  media_urls text[] not null default '{}',
  media_type text not null default 'text' check (media_type in ('text', 'image', 'video')),
  hashtags text[] not null default '{}',
  location text default '',
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'friends', 'private')),
  group_id uuid references public.groups(id) on delete set null,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  shares_count integer not null default 0 check (shares_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.users(uid) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 6. Short Video Reels
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(uid) on delete cascade,
  video_url text not null,
  thumbnail_url text default '',
  caption text default '' check (char_length(caption) <= 1000),
  hashtags text[] not null default '{}',
  audio_title text default '',
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  views_count integer not null default 0 check (views_count >= 0),
  shares_count integer not null default 0 check (shares_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  author_id uuid not null references public.users(uid) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- 7. Stories (24h Expiry & Owner-Only Viewer List)
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(uid) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text default '' check (char_length(caption) <= 240),
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'friends')),
  views_count integer not null default 0 check (views_count >= 0),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.users(uid) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

-- 8. Social Graph: Follows, Friend Requests, Friendships, Blocks, Saved
create table if not exists public.follows (
  follower_id uuid not null references public.users(uid) on delete cascade,
  following_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.users(uid) on delete cascade,
  to_id uuid not null references public.users(uid) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

create table if not exists public.friendships (
  user_a uuid not null references public.users(uid) on delete cascade,
  user_b uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.users(uid) on delete cascade,
  blocked_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.saved_posts (
  user_id uuid not null references public.users(uid) on delete cascade,
  target_id uuid not null,
  target_type text not null check (target_type in ('post', 'reel')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);

-- 9. Real-Time Messenger
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text default '',
  last_message_text text default '',
  last_message_at timestamptz,
  created_by uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uid uuid not null references public.users(uid) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, uid)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(uid) on delete cascade,
  text text not null default '' check (char_length(text) <= 2000),
  attachment_url text default '',
  attachment_type text not null default 'none' check (attachment_type in ('none', 'image', 'video', 'file')),
  reply_to_id uuid references public.messages(id) on delete set null,
  edited boolean not null default false,
  deleted boolean not null default false,
  reactions jsonb not null default '{}'::jsonb,
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. Notifications, Live Streams, Moderation Reports & Governance
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(uid) on delete cascade,
  actor_id uuid not null references public.users(uid) on delete cascade,
  type text not null check (type in ('follow', 'friend_request', 'friend_accept', 'like', 'comment', 'reply', 'mention', 'story_reply', 'message', 'group_invite', 'announcement')),
  target_id text default '',
  message text not null check (char_length(message) between 1 and 300),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users(uid) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  thumbnail_url text default '',
  status text not null default 'live' check (status in ('live', 'ended')),
  viewer_count integer not null default 1 check (viewer_count >= 0),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.live_stream_chat (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  author_id uuid not null references public.users(uid) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(uid) on delete cascade,
  target_type text not null check (target_type in ('post', 'reel', 'comment', 'profile', 'message', 'group', 'story', 'stream')),
  target_id text not null,
  category text not null check (category in ('spam', 'harassment', 'bullying', 'violence', 'sexual_content', 'impersonation', 'copyright', 'other')),
  details text default '' check (char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(uid) on delete cascade,
  action text not null,
  target_id text default '',
  details text default '',
  created_at timestamptz not null default now()
);

-- Enable Row Level Security on every table
alter table public.users enable row level security;
alter table public.user_private_info enable row level security;
alter table public.admins enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.reels enable row level security;
alter table public.reel_likes enable row level security;
alter table public.reel_comments enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.follows enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.saved_posts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_stream_chat enable row level security;
alter table public.reports enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer as $$
  select exists(select 1 from public.admins where uid = auth.uid());
$$;

-- Core RLS Policies
create policy "Active profiles readable by authenticated users" on public.users
  for select to authenticated using (status = 'active' or uid = auth.uid() or public.is_admin());
create policy "Users manage own profile" on public.users
  for insert to authenticated with check (uid = auth.uid());
create policy "Users update own profile" on public.users
  for update to authenticated using (uid = auth.uid() or public.is_admin());

create policy "Private PII isolated to owner" on public.user_private_info
  for all to authenticated using (uid = auth.uid() or public.is_admin()) with check (uid = auth.uid());

create policy "Public posts readable" on public.posts
  for select to authenticated using (visibility = 'public' or author_id = auth.uid() or public.is_admin());
create policy "Authors manage own posts" on public.posts
  for insert to authenticated with check (author_id = auth.uid());
create policy "Authors or admins edit/delete posts" on public.posts
  for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "Authors or admins delete posts" on public.posts
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy "Active 24h stories readable" on public.stories
  for select to authenticated using (expires_at > now() or author_id = auth.uid() or public.is_admin());
create policy "Authors create/delete stories" on public.stories
  for insert to authenticated with check (author_id = auth.uid());
create policy "Authors delete stories" on public.stories
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy "Story views visible only to story author or viewer" on public.story_views
  for select to authenticated using (
    viewer_id = auth.uid() or
    exists(select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
  );
create policy "Viewers record own story view" on public.story_views
  for insert to authenticated with check (viewer_id = auth.uid());

create policy "Conversation members read messages" on public.messages
  for select to authenticated using (
    exists(select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.uid = auth.uid())
  );
create policy "Conversation members send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and
    exists(select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.uid = auth.uid())
  );

create policy "Users read own notifications" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "Users update own notification read flag" on public.notifications
  for update to authenticated using (recipient_id = auth.uid());

create policy "Reports visible to reporter or admin" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "Authenticated users file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- Storage Bucket for Persistent SK World Media
insert into storage.buckets (id, name, public)
values ('skworld-media', 'skworld-media', true)
on conflict (id) do nothing;

create policy "Public read skworld media" on storage.objects
  for select using (bucket_id = 'skworld-media');
create policy "Authenticated upload skworld media" on storage.objects
  for insert to authenticated with check (bucket_id = 'skworld-media');
