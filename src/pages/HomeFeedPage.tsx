import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Image as ImageIcon,
  MapPin,
  Megaphone,
  Plus,
  Send,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import {
  createPost,
  fetchAllActiveUsers,
  toggleFollow,
} from '../services/skworldService';
import type {
  AnnouncementItem,
  PostItem,
  StoryItem,
  UserProfile,
  VisibilityType,
} from '../types/skworld';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { StoryViewerModal } from '../components/StoryViewerModal';

type FeedTab = 'for_you' | 'following' | 'friends' | 'latest';

export const HomeFeedPage: React.FC = () => {
  const { profile, firebaseUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [tab, setTab] = useState<FeedTab>('for_you');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLimit, setFeedLimit] = useState(20);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [friendsA, setFriendsA] = useState<Set<string>>(new Set());
  const [friendsB, setFriendsB] = useState<Set<string>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());

  const friendSet = useMemo(() => new Set([...friendsA, ...friendsB]), [friendsA, friendsB]);

  // Quick composer state
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text');
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Real-time public posts listener
  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    let fallbackUnsub: (() => void) | null = null;
    const q = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(feedLimit)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) })));
        setLoading(false);
      },
      () => {
        // Fallback without composite index if still building
        const q2 = query(collection(db, 'posts'), where('visibility', '==', 'public'), limit(feedLimit));
        fallbackUnsub = onSnapshot(
          q2,
          (snap2) => {
            setPosts(snap2.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) })));
            setLoading(false);
          },
          (err) => {
            setLoading(false);
            handleFirestoreError(err, OperationType.LIST, 'posts');
          }
        );
      }
    );
    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [firebaseUser, feedLimit]);

  // Real-time active stories (24h window)
  useEffect(() => {
    if (!firebaseUser) return;
    let publicStories: StoryItem[] = [];
    let ownStories: StoryItem[] = [];
    const toMillis = (val: unknown) =>
      val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function'
        ? (val as { toMillis: () => number }).toMillis()
        : 0;

    const syncStories = () => {
      const now = Date.now();
      const map = new Map<string, StoryItem>();
      [...publicStories, ...ownStories].forEach((s) => {
        if (toMillis(s.expiresAt) > now) {
          map.set(s.id, s);
        }
      });
      setStories(
        Array.from(map.values())
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          .slice(0, 20)
      );
    };

    const unsubPublic = onSnapshot(
      query(collection(db, 'stories'), where('visibility', '==', 'public'), limit(25)),
      (snap) => {
        publicStories = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoryItem, 'id'>) }));
        syncStories();
      },
      () => {}
    );
    const unsubOwn = onSnapshot(
      query(collection(db, 'stories'), where('authorId', '==', firebaseUser.uid), limit(15)),
      (snap) => {
        ownStories = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoryItem, 'id'>) }));
        syncStories();
      },
      () => {}
    );
    return () => {
      unsubPublic();
      unsubOwn();
    };
  }, [firebaseUser]);

  // Announcements
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'announcements'), where('title', '>', ''), limit(5));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const toMillis = (val: unknown) =>
          val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function'
            ? (val as { toMillis: () => number }).toMillis()
            : 0;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AnnouncementItem, 'id'>) }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          .slice(0, 2);
        setAnnouncements(list);
      },
      () => {}
    );
    return () => unsub();
  }, [firebaseUser]);

  // Social graph: following, friends, saved, blocks, suggested users
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const unsubFollows = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', uid)),
      (snap) => setFollowingSet(new Set(snap.docs.map((d) => (d.data() as { followingId: string }).followingId))),
      () => {}
    );
    const unsubSaved = onSnapshot(
      query(collection(db, 'saved_posts'), where('userId', '==', uid)),
      (snap) => setSavedSet(new Set(snap.docs.map((d) => (d.data() as { targetId: string }).targetId))),
      () => {}
    );
    const unsubBlocks = onSnapshot(
      query(collection(db, 'blocks'), where('blockerId', '==', uid)),
      (snap) => setBlockedSet(new Set(snap.docs.map((d) => (d.data() as { blockedId: string }).blockedId))),
      () => {}
    );
    const unsubFriendsA = onSnapshot(
      query(collection(db, 'friendships'), where('userA', '==', uid)),
      (snap) => {
        setFriendsA(new Set(snap.docs.map((d) => (d.data() as { userB: string }).userB)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );
    const unsubFriendsB = onSnapshot(
      query(collection(db, 'friendships'), where('userB', '==', uid)),
      (snap) => {
        setFriendsB(new Set(snap.docs.map((d) => (d.data() as { userA: string }).userA)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );

    fetchAllActiveUsers(8)
      .then((users) => setSuggestedUsers(users.filter((u) => u.uid !== uid).slice(0, 5)))
      .catch(() => {});

    return () => {
      unsubFollows();
      unsubSaved();
      unsubBlocks();
      unsubFriendsA();
      unsubFriendsB();
    };
  }, [firebaseUser]);

  const filteredPosts = useMemo(() => {
    const visible = posts.filter((p) => !blockedSet.has(p.authorId));
    if (tab === 'following') {
      return visible.filter((p) => followingSet.has(p.authorId) || p.authorId === profile?.uid);
    }
    if (tab === 'friends') {
      return visible.filter((p) => friendSet.has(p.authorId) || p.authorId === profile?.uid);
    }
    if (tab === 'for_you') {
      return [...visible].sort(
        (a, b) =>
          b.likesCount * 2 + b.commentsCount * 3 + b.sharesCount * 4 -
          (a.likesCount * 2 + a.commentsCount * 3 + a.sharesCount * 4)
      );
    }
    return visible;
  }, [posts, tab, blockedSet, followingSet, friendSet, profile?.uid]);

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadMediaFile(f, 'posts')));
      const hasVideo = uploaded.some((u) => u.kind === 'video');
      setMediaType(hasVideo ? 'video' : 'image');
      setMediaUrls((prev) => [...prev, ...uploaded.map((u) => u.url)].slice(0, 6));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Media upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!content.trim() && mediaUrls.length === 0) return;
    setPublishing(true);
    try {
      await createPost({
        author: profile,
        content,
        mediaUrls,
        mediaType: mediaUrls.length === 0 ? 'text' : mediaType,
        location,
        visibility,
      });
      setContent('');
      setLocation('');
      setMediaUrls([]);
      setMediaType('text');
      showToast('Post published to SK World', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not publish post', 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Primary Feed Column */}
      <div className="lg:col-span-8 space-y-5">
        {/* Admin Announcements */}
        {announcements.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-4 flex items-start gap-3"
          >
            <Megaphone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{a.body}</p>
            </div>
          </div>
        ))}

        {/* Stories Carousel */}
        <section aria-label="Stories" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <Link
              to="/stories"
              className="flex flex-col items-center gap-1.5 shrink-0 w-16 group"
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-blue-500 flex items-center justify-center bg-blue-50 dark:bg-blue-950/30 text-blue-600 group-hover:scale-105 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate w-full text-center">
                Add Story
              </span>
            </Link>

            {stories.map((story, idx) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setActiveStoryIndex(idx)}
                className="flex flex-col items-center gap-1.5 shrink-0 w-16 group"
              >
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-blue-600 to-violet-600 group-hover:scale-105 transition-transform">
                  <div className="p-0.5 rounded-full bg-white dark:bg-slate-900">
                    <Avatar src={story.authorAvatar} name={story.authorName} size="md" />
                  </div>
                </div>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate w-full text-center">
                  {story.authorName.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Quick Post Composer */}
        {profile && (
          <form
            onSubmit={handlePublish}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-start gap-3">
              <Avatar src={profile.avatarUrl} name={profile.fullName} size="md" />
              <textarea
                rows={2}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('whatsOnYourMind')}
                maxLength={5000}
                className="flex-1 resize-none bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none pt-1.5"
              />
            </div>

            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {mediaUrls.map((url, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {mediaType === 'video' ? (
                      <video src={url} controls className="w-full h-24 rounded-xl object-cover bg-black" />
                    ) : (
                      <img src={url} alt={`Upload preview ${idx + 1}`} className="w-full h-24 rounded-xl object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove media"
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/65 text-white hover:bg-black/85"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <span>Photo</span>
                  <input type="file" accept="image/*" multiple onChange={(e) => void handleMediaSelect(e)} className="hidden" />
                </label>
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Video className="w-4 h-4 text-violet-600" />
                  <span>Video</span>
                  <input type="file" accept="video/mp4,video/webm" onChange={(e) => void handleMediaSelect(e)} className="hidden" />
                </label>
                <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Location"
                    maxLength={100}
                    className="w-24 bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as VisibilityType)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="friends">Friends</option>
                  <option value="private">Only Me</option>
                </select>
                <button
                  type="submit"
                  disabled={publishing || uploading || (!content.trim() && mediaUrls.length === 0)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : publishing ? 'Publishing...' : t('post')}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Feed Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          {(
            [
              { id: 'for_you', label: t('forYou') },
              { id: 'following', label: t('following') },
              { id: 'friends', label: t('friendsFeed') },
              { id: 'latest', label: t('latest') },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Feed Posts */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 animate-pulse space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
            <Sparkles className="w-8 h-8 text-blue-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('emptyFeedTitle')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {t('emptyFeedDesc')}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                to="/explore"
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold"
              >
                Explore Creators
              </Link>
              <Link
                to="/create"
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Create First Post
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} isSavedInitial={savedSet.has(post.id)} />
            ))}
            {posts.length >= feedLimit && (
              <button
                type="button"
                onClick={() => setFeedLimit((l) => l + 15)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Load more posts
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Discovery Column (Desktop) */}
      <aside className="hidden lg:block lg:col-span-4 space-y-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              People on SK World
            </h2>
            <Link to="/friends" className="text-xs font-medium text-blue-600 hover:underline">
              See all
            </Link>
          </div>
          {suggestedUsers.length === 0 ? (
            <p className="text-xs text-slate-500">Invite friends or explore creators as the community grows.</p>
          ) : (
            <div className="space-y-3">
              {suggestedUsers.map((u) => {
                const isFollowing = followingSet.has(u.uid);
                return (
                  <div key={u.uid} className="flex items-center justify-between gap-3">
                    <Link to={`/profile/${u.username}`} className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={u.avatarUrl} name={u.fullName} size="sm" verified={u.isVerified} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {u.fullName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                      </div>
                    </Link>
                    {profile && (
                      <button
                        type="button"
                        onClick={() => void toggleFollow(profile, u.uid, isFollowing)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold shrink-0 ${
                          isFollowing
                            ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isFollowing ? t('unfollow') : t('follow')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white mb-3">
            Community Showcase
          </h2>
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <img
              src="/src/assets/images/community_cover_tech_1795185891829.jpg"
              alt="SK World Creators"
              className="w-full h-32 object-cover"
            />
            <div className="p-3.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Explore Groups & Live Rooms
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Join public communities, launch real-time discussions, and grow your audience.
              </p>
              <Link
                to="/groups"
                className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline"
              >
                Browse Groups →
              </Link>
            </div>
          </div>
        </div>

        <footer className="px-2 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
          <Link to="/about" className="hover:underline">{t('about')}</Link>
          <Link to="/help" className="hover:underline">{t('helpCenter')}</Link>
          <Link to="/privacy-policy" className="hover:underline">{t('privacyPolicy')}</Link>
          <Link to="/terms" className="hover:underline">{t('terms')}</Link>
        </footer>
      </aside>

      {activeStoryIndex !== null && stories.length > 0 && (
        <StoryViewerModal
          stories={stories}
          initialIndex={activeStoryIndex}
          onClose={() => setActiveStoryIndex(null)}
        />
      )}
    </div>
  );
};
