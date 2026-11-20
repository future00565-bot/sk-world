import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, MapPin, Send, UsersRound, Video, X } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import { createPost } from '../services/skworldService';
import type { GroupItem, VisibilityType } from '../types/skworld';

export const CreatePostPage: React.FC = () => {
  const { profile, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    let pubList: GroupItem[] = [];
    let myList: GroupItem[] = [];
    const sync = () => {
      const map = new Map<string, GroupItem>();
      [...pubList, ...myList].forEach((g) => map.set(g.id, g));
      setGroups(Array.from(map.values()));
    };
    const unsubPub = onSnapshot(
      query(collection(db, 'groups'), where('privacy', '==', 'public')),
      (snap) => {
        pubList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroupItem, 'id'>) }));
        sync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'groups')
    );
    const unsubMine = onSnapshot(
      query(collection(db, 'groups'), where('creatorId', '==', firebaseUser.uid)),
      (snap) => {
        myList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroupItem, 'id'>) }));
        sync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'groups')
    );
    return () => {
      unsubPub();
      unsubMine();
    };
  }, [firebaseUser]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - mediaUrls.length);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const results = await Promise.all(files.map((f) => uploadMediaFile(f, 'posts')));
      const hasVideo = results.some((r) => r.kind === 'video');
      setMediaType(hasVideo ? 'video' : 'image');
      setMediaUrls((prev) => [...prev, ...results.map((r) => r.url)].slice(0, 6));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!content.trim() && mediaUrls.length === 0) {
      showToast('Add text, photos, or a video before publishing.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createPost({
        author: profile,
        content,
        mediaUrls,
        mediaType: mediaUrls.length === 0 ? 'text' : mediaType,
        location,
        visibility,
        groupId,
      });
      showToast('Post published successfully!', 'success');
      navigate('/');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Create Post
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Share text updates, multi-photo galleries, or videos with hashtags and location.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            rows={5}
            maxLength={5000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your caption, story, or #hashtags..."
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 text-sm sm:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {mediaType === 'video' ? (
                    <video src={url} controls className="w-full h-36 object-cover" />
                  ) : (
                    <img src={url} alt={`Attachment ${idx + 1}`} className="w-full h-36 object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                    aria-label="Remove media"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                maxLength={100}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location (optional)"
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50">
              <UsersRound className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="">Main News Feed</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Group: {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>Add Photos</span>
                <input type="file" accept="image/*" multiple onChange={(e) => void handleFiles(e)} className="hidden" />
              </label>
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Video className="w-4 h-4 text-violet-600" />
                <span>Add Video</span>
                <input type="file" accept="video/mp4,video/webm" onChange={(e) => void handleFiles(e)} className="hidden" />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as VisibilityType)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="friends">Friends</option>
                <option value="private">Only Me</option>
              </select>
              <button
                type="submit"
                disabled={uploading || submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 text-sm font-semibold"
              >
                <Send className="w-4 h-4" />
                <span>{uploading ? 'Uploading...' : submitting ? 'Publishing...' : 'Publish'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
