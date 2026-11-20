import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  Film,
  Heart,
  MessageCircle,
  Music,
  Pause,
  Play,
  Plus,
  Send,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import { createReel, toggleFollow, toggleSavedItem } from '../services/skworldService';
import type { CommentItem, ReelItem } from '../types/skworld';
import { Avatar } from '../components/Avatar';

const ReelCard: React.FC<{
  reel: ReelItem;
  muted: boolean;
  onToggleMute: () => void;
  isFollowing: boolean;
  isSaved: boolean;
}> = ({ reel, muted, onToggleMute, isFollowing, isSaved }) => {
  const { profile, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const viewRecordedRef = useRef(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
            if (!viewRecordedRef.current) {
              viewRecordedRef.current = true;
              updateDoc(doc(db, 'reels', reel.id), { viewsCount: increment(1) }).catch(() => {});
            }
          } else {
            el.pause();
            setPlaying(false);
          }
        });
      },
      { threshold: [0.65] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reel.id]);

  useEffect(() => {
    if (!firebaseUser) return;
    getDoc(doc(db, 'reels', reel.id, 'likes', firebaseUser.uid))
      .then((snap) => setLiked(snap.exists()))
      .catch(() => {});
  }, [reel.id, firebaseUser]);

  useEffect(() => {
    if (!commentsOpen) return;
    const q = query(collection(db, 'reels', reel.id, 'comments'), where('targetId', '==', reel.id));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const toMillis = (val: unknown) =>
          val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function'
            ? (val as { toMillis: () => number }).toMillis()
            : 0;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<CommentItem, 'id'>) }))
          .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
        setComments(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `reels/${reel.id}/comments`);
      }
    );
    return () => unsub();
  }, [reel.id, commentsOpen]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const handleLike = async () => {
    if (!firebaseUser) return;
    const ref = doc(db, 'reels', reel.id, 'likes', firebaseUser.uid);
    const prev = liked;
    setLiked(!prev);
    try {
      if (prev) {
        await deleteDoc(ref);
        await updateDoc(doc(db, 'reels', reel.id), { likesCount: increment(-1) });
      } else {
        await setDoc(ref, { userId: firebaseUser.uid, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'reels', reel.id), { likesCount: increment(1) });
      }
    } catch {
      setLiked(prev);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !commentInput.trim()) return;
    const text = commentInput.trim();
    setCommentInput('');
    try {
      await addDoc(collection(db, 'reels', reel.id, 'comments'), {
        targetId: reel.id,
        authorId: profile.uid,
        authorName: profile.fullName,
        authorUsername: profile.username,
        authorAvatar: profile.avatarUrl || '',
        content: text.slice(0, 1000),
        parentCommentId: '',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'reels', reel.id), { commentsCount: increment(1) });
    } catch {
      showToast('Failed to post comment', 'error');
    }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel.id}`);
    await updateDoc(doc(db, 'reels', reel.id), { sharesCount: increment(1) }).catch(() => {});
    showToast('Reel link copied', 'success');
  };

  const handleDeleteReel = async () => {
    if (!profile || profile.uid !== reel.authorId) return;
    try {
      await deleteDoc(doc(db, 'reels', reel.id));
      showToast('Reel deleted', 'info');
    } catch {
      showToast('Failed to delete Reel', 'error');
    }
  };

  return (
    <div className="snap-start relative h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-4.5rem)] w-full max-w-[420px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-lg flex items-center justify-center my-2">
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.thumbnailUrl || '/src/assets/images/reel_poster_urban_1795185892433.jpg'}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onClick={togglePlay}
        className="w-full h-full object-cover cursor-pointer"
      />

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center"
        >
          <Play className="w-8 h-8 ml-1" />
        </button>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {profile?.uid === reel.authorId && (
          <button
            type="button"
            onClick={() => void handleDeleteReel()}
            aria-label="Delete Reel"
            className="p-2.5 rounded-full bg-black/45 text-white hover:bg-rose-600/80"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="p-2.5 rounded-full bg-black/45 text-white hover:bg-black/65"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="p-2.5 rounded-full bg-black/45 text-white hover:bg-black/65"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom Scrim & Metadata */}
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />
      <div className="absolute bottom-5 left-4 right-16 z-10 text-white space-y-2">
        <div className="flex items-center gap-2.5">
          <Link to={`/profile/${reel.authorUsername}`}>
            <Avatar src={reel.authorAvatar} name={reel.authorName} size="sm" />
          </Link>
          <Link to={`/profile/${reel.authorUsername}`} className="font-semibold text-sm hover:underline">
            @{reel.authorUsername}
          </Link>
          {profile && profile.uid !== reel.authorId && (
            <button
              type="button"
              onClick={() => void toggleFollow(profile, reel.authorId, isFollowing)}
              className="rounded-lg border border-white/40 bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25"
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        {reel.caption && <p className="text-sm text-white/95 line-clamp-2">{reel.caption}</p>}
        <div className="flex items-center gap-2 text-xs text-white/80">
          <Music className="w-3.5 h-3.5" />
          <span className="truncate">{reel.audioTitle || `Original Audio · ${reel.authorName}`}</span>
        </div>
      </div>

      {/* Right Interaction Rail */}
      <div className="absolute bottom-5 right-3 z-10 flex flex-col items-center gap-4 text-white">
        <button type="button" onClick={() => void handleLike()} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
            <Heart className={`w-5 h-5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </div>
          <span className="text-xs font-mono-tabular">{reel.likesCount}</span>
        </button>

        <button type="button" onClick={() => setCommentsOpen(true)} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono-tabular">{reel.commentsCount}</span>
        </button>

        <button
          type="button"
          onClick={() =>
            firebaseUser && void toggleSavedItem(firebaseUser.uid, reel.id, 'reel', isSaved)
          }
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-blue-400 text-blue-400' : ''}`} />
          </div>
          <span className="text-[11px]">Save</span>
        </button>

        <button type="button" onClick={() => void handleShare()} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono-tabular">{reel.sharesCount}</span>
        </button>
      </div>

      {/* Comments Drawer */}
      {commentsOpen && (
        <div className="absolute inset-0 z-20 bg-black/60 flex items-end">
          <div className="w-full h-[65%] rounded-t-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold">Comments ({comments.length})</h3>
              <button type="button" onClick={() => setCommentsOpen(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <Avatar src={c.authorAvatar} name={c.authorName} size="xs" />
                    <div>
                      <p className="text-xs font-semibold">@{c.authorUsername}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleComment} className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <button type="submit" className="p-2.5 rounded-xl bg-blue-600 text-white">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const ReelsPage: React.FC = () => {
  const { profile, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const targetReelId = searchParams.get('id');

  const [reels, setReels] = useState<ReelItem[]>([]);
  const [linkedReel, setLinkedReel] = useState<ReelItem | null>(null);
  const [muted, setMuted] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

  // Upload form
  const [caption, setCaption] = useState('');
  const [audioTitle, setAudioTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubReels = onSnapshot(
      query(collection(db, 'reels'), where('videoUrl', '>', ''), limit(25)),
      (snap) => {
        const toMillis = (val: unknown) =>
          val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function'
            ? (val as { toMillis: () => number }).toMillis()
            : 0;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ReelItem, 'id'>) }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setReels(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reels')
    );
    const unsubFollows = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', firebaseUser.uid)),
      (snap) => setFollowingSet(new Set(snap.docs.map((d) => (d.data() as { followingId: string }).followingId))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );
    const unsubSaved = onSnapshot(
      query(collection(db, 'saved_posts'), where('userId', '==', firebaseUser.uid)),
      (snap) => setSavedSet(new Set(snap.docs.map((d) => (d.data() as { targetId: string }).targetId))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'saved_posts')
    );
    return () => {
      unsubReels();
      unsubFollows();
      unsubSaved();
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !targetReelId) {
      setLinkedReel(null);
      return;
    }
    getDoc(doc(db, 'reels', targetReelId))
      .then((snap) => {
        if (snap.exists()) {
          setLinkedReel({ id: snap.id, ...(snap.data() as Omit<ReelItem, 'id'>) });
        } else {
          setLinkedReel(null);
        }
      })
      .catch(() => setLinkedReel(null));
  }, [firebaseUser, targetReelId]);

  const orderedReels = useMemo(() => {
    if (!targetReelId) return reels;
    const inFeed = reels.find((r) => r.id === targetReelId) || linkedReel;
    if (!inFeed) return reels;
    return [inFeed, ...reels.filter((r) => r.id !== targetReelId)];
  }, [reels, linkedReel, targetReelId]);

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      showToast('Please select an MP4 or WebM video file.', 'error');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadMediaFile(file, 'reels');
      setVideoUrl(res.url);
      showToast('Video ready to publish!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Video upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !videoUrl) return;
    try {
      await createReel({
        author: profile,
        videoUrl,
        caption,
        audioTitle,
      });
      setCaption('');
      setAudioTitle('');
      setVideoUrl('');
      setUploadOpen(false);
      showToast('Reel published!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish Reel', 'error');
    }
  };

  return (
    <div className="relative h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="px-4 py-2 flex items-center justify-between max-w-[440px] w-full mx-auto">
        <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-violet-600" />
          Reels
        </h1>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Upload Reel
        </button>
      </div>

      {orderedReels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <img
              src="/src/assets/images/reel_poster_urban_1795185892433.jpg"
              alt="Reels showcase"
              className="w-28 h-44 mx-auto rounded-2xl object-cover mb-4"
            />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">No Reels published yet</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upload an MP4 or WebM vertical short video to kick off the SK World Reels feed.
            </p>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="mt-4 rounded-xl bg-blue-600 text-white px-4 py-2 text-xs font-semibold"
            >
              Upload First Reel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto snap-y snap-mandatory px-2">
          {orderedReels.map((reel) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              isFollowing={followingSet.has(reel.authorId)}
              isSaved={savedSet.has(reel.id)}
            />
          ))}
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Upload Short Video Reel
              </h2>
              <button type="button" onClick={() => setUploadOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateReel} className="space-y-4">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-5 text-center hover:border-blue-500">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {uploading ? 'Uploading video...' : videoUrl ? 'Video uploaded! Click to replace' : 'Select MP4 or WebM video (max 50MB)'}
                </p>
                <input type="file" accept="video/mp4,video/webm" onChange={(e) => void handleVideoFile(e)} className="hidden" />
              </label>

              {videoUrl && (
                <video src={videoUrl} controls className="w-full max-h-48 rounded-xl bg-black" />
              )}

              <textarea
                rows={3}
                maxLength={1000}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption and #hashtags..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm"
              />
              <input
                type="text"
                maxLength={120}
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="Audio track title (optional)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!videoUrl || uploading}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 text-sm font-semibold"
              >
                Publish Reel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
