import React, { useEffect, useState } from 'react';
import { Clock, Flame, Image as ImageIcon, Plus, Video, X } from 'lucide-react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatRelativeTime } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import { createStory } from '../services/skworldService';
import type { StoryItem } from '../types/skworld';
import { Avatar } from '../components/Avatar';
import { StoryViewerModal } from '../components/StoryViewerModal';

function toMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  return 0;
}

export const StoriesPage: React.FC = () => {
  const { profile, firebaseUser } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'friends'>('public');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    let publicStories: StoryItem[] = [];
    let ownStories: StoryItem[] = [];

    const syncMerged = () => {
      const now = Date.now();
      const map = new Map<string, StoryItem>();
      [...publicStories, ...ownStories].forEach((s) => {
        if (toMillis(s.expiresAt) > now) {
          map.set(s.id, s);
        }
      });
      const merged = Array.from(map.values()).sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
      );
      setStories(merged);
    };

    const unsubPublic = onSnapshot(
      query(collection(db, 'stories'), where('visibility', '==', 'public'), limit(50)),
      (snap) => {
        publicStories = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoryItem, 'id'>) }));
        syncMerged();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'stories')
    );

    const unsubOwn = onSnapshot(
      query(collection(db, 'stories'), where('authorId', '==', firebaseUser.uid), limit(25)),
      (snap) => {
        ownStories = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoryItem, 'id'>) }));
        syncMerged();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'stories')
    );

    return () => {
      unsubPublic();
      unsubOwn();
    };
  }, [firebaseUser]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadMediaFile(file, 'stories');
      setMediaUrl(res.url);
      setMediaType(res.kind === 'video' ? 'video' : 'image');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Story upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !mediaUrl) return;
    try {
      await createStory({
        author: profile,
        mediaUrl,
        mediaType,
        caption,
        visibility,
      });
      setMediaUrl('');
      setCaption('');
      showToast('Story published for 24 hours!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not publish story', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Flame className="w-6 h-6 text-blue-600" />
          Stories
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Share 24-hour disappearing moments with full viewer privacy controls.
        </p>
      </div>

      {/* Story Creator */}
      <form
        onSubmit={handlePublish}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Create a 24h Story</h2>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" /> Expires automatically after 24 hours
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <span>Upload Photo</span>
            <input type="file" accept="image/*" onChange={(e) => void handleFile(e)} className="hidden" />
          </label>
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
            <Video className="w-4 h-4 text-violet-600" />
            <span>Upload Video</span>
            <input type="file" accept="video/mp4,video/webm" onChange={(e) => void handleFile(e)} className="hidden" />
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'public' | 'followers' | 'friends')}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="public">Public</option>
            <option value="followers">Followers Only</option>
            <option value="friends">Friends Only</option>
          </select>
        </div>

        {mediaUrl && (
          <div className="relative w-40 h-64 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700">
            {mediaType === 'video' ? (
              <video src={mediaUrl} controls className="w-full h-full object-cover" />
            ) : (
              <img src={mediaUrl} alt="Story preview" className="w-full h-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => setMediaUrl('')}
              aria-label="Remove story media"
              className="absolute top-2 right-2 p-1 rounded-full bg-black/65 text-white hover:bg-black/85"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="text"
            maxLength={240}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add an optional caption..."
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!mediaUrl || uploading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Share Story'}
          </button>
        </div>
      </form>

      {/* Active Stories Grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Active Stories ({stories.length})
        </h2>
        {stories.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <img
              src="/src/assets/images/story_travel_horizon_1795185893002.jpg"
              alt="Story preview"
              className="w-24 h-40 mx-auto rounded-2xl object-cover mb-3"
            />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">No active stories right now</p>
            <p className="text-xs text-slate-500 mt-1">Share a photo or short clip above — it stays live for 24 hours.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stories.map((story, idx) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setViewerIndex(idx)}
                className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 group text-left"
              >
                {story.mediaType === 'video' ? (
                  <video src={story.mediaUrl} muted preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={story.mediaUrl}
                    alt={story.authorName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                <div className="absolute top-3 left-3">
                  <Avatar src={story.authorAvatar} name={story.authorName} size="sm" />
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-xs font-semibold truncate">{story.authorName}</p>
                  <p className="text-[11px] text-white/75">{formatRelativeTime(story.createdAt, language)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {viewerIndex !== null && (
        <StoryViewerModal
          stories={stories}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
};
