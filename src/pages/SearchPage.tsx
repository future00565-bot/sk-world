import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchAllActiveUsers } from '../services/skworldService';
import type { GroupItem, PostItem, ReelItem, UserProfile } from '../types/skworld';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [filter, setFilter] = useState<'all' | 'users' | 'posts' | 'reels' | 'groups'>('all');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);

  useEffect(() => {
    setQueryText(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    fetchAllActiveUsers(50).then(setUsers).catch(() => {});
    getDocs(query(collection(db, 'posts'), where('visibility', '==', 'public'), limit(40)))
      .then((s) => setPosts(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) }))))
      .catch(() => {});
    getDocs(query(collection(db, 'reels'), where('videoUrl', '>', ''), limit(25)))
      .then((s) => setReels(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReelItem, 'id'>) }))))
      .catch(() => {});
    getDocs(query(collection(db, 'groups'), where('privacy', '==', 'public'), limit(25)))
      .then((s) => setGroups(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroupItem, 'id'>) }))))
      .catch(() => {});
  }, []);

  const term = queryText.trim().toLowerCase().replace(/^#/, '');

  const matchedUsers = useMemo(
    () =>
      !term
        ? users.slice(0, 6)
        : users.filter(
            (u) =>
              u.fullName.toLowerCase().includes(term) ||
              u.username.toLowerCase().includes(term) ||
              (u.bio || '').toLowerCase().includes(term)
          ),
    [users, term]
  );

  const matchedPosts = useMemo(
    () =>
      !term
        ? posts.slice(0, 10)
        : posts.filter(
            (p) =>
              p.content.toLowerCase().includes(term) ||
              p.authorName.toLowerCase().includes(term) ||
              p.hashtags?.some((h) => h.includes(term))
          ),
    [posts, term]
  );

  const matchedReels = useMemo(
    () =>
      !term
        ? reels.slice(0, 6)
        : reels.filter(
            (r) =>
              r.caption.toLowerCase().includes(term) ||
              r.hashtags?.some((h) => h.includes(term))
          ),
    [reels, term]
  );

  const matchedGroups = useMemo(
    () =>
      !term
        ? groups.slice(0, 6)
        : groups.filter(
            (g) =>
              g.name.toLowerCase().includes(term) || g.description.toLowerCase().includes(term)
          ),
    [groups, term]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Search SK World
        </h1>
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            placeholder="Search people, #hashtags, posts, videos, or groups..."
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-12 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          {(['all', 'users', 'posts', 'reels', 'groups'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                filter === f
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {(filter === 'all' || filter === 'users') && matchedUsers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">People</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matchedUsers.map((u) => (
              <Link
                key={u.uid}
                to={`/profile/${u.username}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-500 transition-colors"
              >
                <Avatar src={u.avatarUrl} name={u.fullName} size="md" verified={u.isVerified} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{u.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(filter === 'all' || filter === 'groups') && matchedGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Groups</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matchedGroups.map((g) => (
              <Link
                key={g.id}
                to={`/groups?id=${g.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-500"
              >
                <p className="font-semibold text-sm">{g.name}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(filter === 'all' || filter === 'reels') && matchedReels.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Reels</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {matchedReels.map((r) => (
              <Link key={r.id} to={`/reels?id=${r.id}`} className="aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 relative">
                <video src={r.videoUrl} muted preload="metadata" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 text-white text-xs truncate">
                  {r.caption || `@${r.authorUsername}`}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(filter === 'all' || filter === 'posts') && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Posts</h2>
          {matchedPosts.length === 0 ? (
            <p className="text-sm text-slate-500">No matching posts found.</p>
          ) : (
            matchedPosts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </section>
      )}
    </div>
  );
};
