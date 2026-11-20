import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Eye,
  Film,
  Heart,
  MessageCircle,
  PlusSquare,
  Share2,
  Users,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRelativeTime } from '../lib/i18n';
import type { PostItem, ReelItem } from '../types/skworld';

type DateRange = '7d' | '30d' | 'all';

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (ts instanceof Date) return ts.getTime();
  const parsed = Date.parse(String(ts));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const CreatorDashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const { language, t } = useLanguage();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [range, setRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    Promise.all([
      getDocs(query(collection(db, 'posts'), where('authorId', '==', profile.uid))),
      getDocs(query(collection(db, 'reels'), where('authorId', '==', profile.uid))),
    ])
      .then(([postSnap, reelSnap]) => {
        setPosts(postSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) })));
        setReels(reelSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReelItem, 'id'>) })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile]);

  const { filteredPosts, filteredReels, totals } = useMemo(() => {
    const cutoff =
      range === '7d'
        ? Date.now() - 7 * 86_400_000
        : range === '30d'
          ? Date.now() - 30 * 86_400_000
          : 0;

    const fp = posts.filter((p) => toMillis(p.createdAt) >= cutoff);
    const fr = reels.filter((r) => toMillis(r.createdAt) >= cutoff);

    const likes =
      fp.reduce((s, p) => s + p.likesCount, 0) + fr.reduce((s, r) => s + r.likesCount, 0);
    const comments =
      fp.reduce((s, p) => s + p.commentsCount, 0) + fr.reduce((s, r) => s + r.commentsCount, 0);
    const shares =
      fp.reduce((s, p) => s + p.sharesCount, 0) + fr.reduce((s, r) => s + r.sharesCount, 0);
    const reelViews = fr.reduce((s, r) => s + r.viewsCount, 0);
    const interactions = likes + comments + shares;
    const avgEngagement =
      fp.length + fr.length > 0 ? (interactions / (fp.length + fr.length)).toFixed(1) : '0.0';

    return {
      filteredPosts: fp.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
      filteredReels: fr.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
      totals: {
        publishedCount: fp.length + fr.length,
        likes,
        comments,
        shares,
        reelViews,
        avgEngagement,
      },
    };
  }, [posts, reels, range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t('creatorDashboard')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time engagement and audience metrics computed directly from your published content.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
          {(
            [
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Followers</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {profile?.followersCount ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Reel Views</span>
            <Eye className="w-4 h-4 text-violet-600" />
          </div>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {totals.reelViews}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Likes</span>
            <Heart className="w-4 h-4 text-rose-600" />
          </div>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {totals.likes}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Comments & Shares</span>
            <MessageCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {totals.comments + totals.shares}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Avg Interactions / Item</span>
            <BarChart3 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {totals.avgEngagement}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 animate-pulse space-y-3">
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ) : filteredPosts.length === 0 && filteredReels.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <BarChart3 className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            No published content in this period
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish a post or upload a Reel to start tracking authentic engagement metrics.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              to="/create"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold"
            >
              <PlusSquare className="w-4 h-4" />
              <span>{t('create')}</span>
            </Link>
            <Link
              to="/reels"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <Film className="w-4 h-4" />
              <span>{t('reels')}</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Posts Performance Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Post Performance ({filteredPosts.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {filteredPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/post/${post.id}`}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {post.content || `[${post.mediaType} post]`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatRelativeTime(post.createdAt, language)} · {post.visibility}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono-tabular text-slate-600 dark:text-slate-300 shrink-0">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      {post.likesCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                      {post.commentsCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                      {post.sharesCount}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Reels Performance Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Reels Performance ({filteredReels.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {filteredReels.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 text-center">No Reels uploaded in this period.</p>
              ) : (
                filteredReels.map((reel) => (
                  <Link
                    key={reel.id}
                    to={`/reels?id=${reel.id}`}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {reel.caption || 'Untitled Reel'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatRelativeTime(reel.createdAt, language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono-tabular text-slate-600 dark:text-slate-300 shrink-0">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-violet-500" />
                        {reel.viewsCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        {reel.likesCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                        {reel.commentsCount}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
