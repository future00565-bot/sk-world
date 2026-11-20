import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Flame, Hash, TrendingUp, Users } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllActiveUsers, toggleFollow } from '../services/skworldService';
import type { PostItem, ReelItem, UserProfile } from '../types/skworld';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';

export const ExplorePage: React.FC = () => {
  const { profile, firebaseUser } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [creators, setCreators] = useState<UserProfile[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!firebaseUser) return;
    let fallbackUnsub: (() => void) | null = null;
    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('visibility', '==', 'public'), orderBy('likesCount', 'desc'), limit(15)),
      (snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) }))),
      () => {
        fallbackUnsub = onSnapshot(
          query(collection(db, 'posts'), where('visibility', '==', 'public'), limit(15)),
          (snap2) => {
            setPosts(snap2.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) })));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
        );
      }
    );
    const unsubReels = onSnapshot(
      query(collection(db, 'reels'), where('videoUrl', '>', ''), limit(8)),
      (snap) => setReels(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReelItem, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'reels')
    );
    const unsubFollows = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', firebaseUser.uid)),
      (snap) => setFollowingSet(new Set(snap.docs.map((d) => (d.data() as { followingId: string }).followingId))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );
    fetchAllActiveUsers(12)
      .then((list) => setCreators(list.filter((u) => u.uid !== firebaseUser.uid)))
      .catch(() => {});

    return () => {
      unsubPosts();
      if (fallbackUnsub) fallbackUnsub();
      unsubReels();
      unsubFollows();
    };
  }, [firebaseUser]);

  const popularHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) =>
      p.hashtags?.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1))
    );
    reels.forEach((r) =>
      r.hashtags?.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1))
    );
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [posts, reels]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Explore SK World
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Trending posts, short videos, rising creators, and active hashtags.
          </p>
        </div>
        <Link
          to="/search"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 self-start"
        >
          Open Advanced Search
        </Link>
      </div>

      {/* Popular Hashtags */}
      {popularHashtags.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-violet-600" />
            Trending Hashtags
          </h2>
          <div className="flex flex-wrap gap-4">
            {popularHashtags.map(([tag, count]) => (
              <Link
                key={tag}
                to={`/search?q=${encodeURIComponent(tag)}`}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                #{tag}{' '}
                <span className="font-mono-tabular text-xs text-slate-400">({count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Popular Creators */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-blue-600" />
          Popular Creators
        </h2>
        {creators.length === 0 ? (
          <p className="text-sm text-slate-500">More creators will appear here as members join SK World.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creators.slice(0, 6).map((c) => {
              const isFollowing = followingSet.has(c.uid);
              return (
                <div
                  key={c.uid}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5"
                >
                  <Link to={`/profile/${c.username}`} className="flex items-center gap-3 min-w-0">
                    <Avatar src={c.avatarUrl} name={c.fullName} size="md" verified={c.isVerified} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {c.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        @{c.username} · <span className="font-mono-tabular">{c.followersCount}</span> followers
                      </p>
                    </div>
                  </Link>
                  {profile && (
                    <button
                      type="button"
                      onClick={() => void toggleFollow(profile, c.uid, isFollowing)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold shrink-0 ${
                        isFollowing
                          ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Trending Reels Preview */}
      {reels.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-violet-600" />
              Trending Reels
            </h2>
            <Link to="/reels" className="text-xs font-semibold text-blue-600 hover:underline">
              Watch Reels →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {reels.slice(0, 4).map((r) => (
              <Link
                key={r.id}
                to={`/reels?id=${r.id}`}
                className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 group"
              >
                <video
                  src={r.videoUrl}
                  poster={r.thumbnailUrl || '/src/assets/images/reel_poster_urban_1795185892433.jpg'}
                  muted
                  preload="metadata"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                  <p className="text-xs font-semibold truncate">@{r.authorUsername}</p>
                  <p className="text-[11px] text-white/80 font-mono-tabular">{r.viewsCount} views</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trending Posts */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-500" />
          Trending Posts
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-slate-500">No public posts found yet.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
