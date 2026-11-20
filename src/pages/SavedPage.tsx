import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Film } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toggleSavedItem } from '../services/skworldService';
import type { PostItem, ReelItem } from '../types/skworld';
import { PostCard } from '../components/PostCard';

export const SavedPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [tab, setTab] = useState<'all' | 'posts' | 'reels'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'saved_posts'), where('userId', '==', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const items = snap.docs.map((d) => d.data() as { targetId: string; targetType: string });
        const postIds = items.filter((i) => i.targetType === 'post').map((i) => i.targetId);
        const reelIds = items.filter((i) => i.targetType === 'reel').map((i) => i.targetId);

        const loadedPosts: PostItem[] = [];
        const loadedReels: ReelItem[] = [];

        await Promise.all([
          ...postIds.map(async (id) => {
            try {
              const pSnap = await getDoc(doc(db, 'posts', id));
              if (pSnap.exists()) {
                loadedPosts.push({ id: pSnap.id, ...(pSnap.data() as Omit<PostItem, 'id'>) });
              }
            } catch {
              // Skip deleted or inaccessible posts
            }
          }),
          ...reelIds.map(async (id) => {
            try {
              const rSnap = await getDoc(doc(db, 'reels', id));
              if (rSnap.exists()) {
                loadedReels.push({ id: rSnap.id, ...(rSnap.data() as Omit<ReelItem, 'id'>) });
              }
            } catch {
              // Skip deleted or inaccessible reels
            }
          }),
        ]);

        setPosts(loadedPosts);
        setReels(loadedReels);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'saved_posts');
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  const showPosts = (tab === 'all' || tab === 'posts') && posts.length > 0;
  const showReels = (tab === 'all' || tab === 'reels') && reels.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-blue-600" />
            Saved Items
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your private collection of bookmarked posts and Reels across SK World.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 self-start">
          {(
            [
              { id: 'all', label: `All (${posts.length + reels.length})` },
              { id: 'posts', label: `Posts (${posts.length})` },
              { id: 'reels', label: `Reels (${reels.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                tab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 animate-pulse h-32" />
      ) : !showPosts && !showReels ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
          No saved items in this view yet. Tap the bookmark icon on any post or Reel to save it here.
        </div>
      ) : (
        <div className="space-y-6">
          {showReels && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-violet-600" />
                Saved Reels ({reels.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {reels.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                  >
                    <Link to={`/reels?id=${r.id}`} className="block relative aspect-[9/16] bg-slate-950">
                      <video
                        src={r.videoUrl}
                        poster={r.thumbnailUrl || '/src/assets/images/reel_poster_urban_1795185892433.jpg'}
                        muted
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 text-white">
                        <p className="text-xs font-semibold truncate">@{r.authorUsername}</p>
                        {r.caption && <p className="text-[11px] text-white/80 truncate">{r.caption}</p>}
                      </div>
                    </Link>
                    {firebaseUser && (
                      <button
                        type="button"
                        onClick={() => void toggleSavedItem(firebaseUser.uid, r.id, 'reel', true)}
                        className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Remove Bookmark
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {showPosts && (
            <section className="space-y-4">
              {tab === 'all' && (
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Saved Posts ({posts.length})
                </h2>
              )}
              {posts.map((p) => (
                <PostCard key={p.id} post={p} isSavedInitial />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
