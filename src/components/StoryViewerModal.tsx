import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Send, Trash2, X } from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatRelativeTime } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  getOrCreateDirectConversation,
  recordStoryView,
  sendChatMessage,
} from '../services/skworldService';
import type { StoryItem, StoryViewItem, UserProfile } from '../types/skworld';
import { Avatar } from './Avatar';

interface StoryViewerModalProps {
  stories: StoryItem[];
  initialIndex: number;
  onClose: () => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialIndex,
  onClose,
}) => {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();

  const [index, setIndex] = useState(initialIndex);
  const [replyText, setReplyText] = useState('');
  const [viewers, setViewers] = useState<StoryViewItem[]>([]);
  const [showViewers, setShowViewers] = useState(false);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const story = stories[index];
  const isOwner = profile?.uid === story?.authorId;

  useEffect(() => {
    if (!story || !profile) return;
    void recordStoryView(story.id, profile);
  }, [story, profile]);

  useEffect(() => {
    if (!story || !isOwner) {
      setViewers([]);
      return;
    }
    const q = query(collection(db, 'stories', story.id, 'views'), orderBy('viewedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setViewers(snap.docs.map((d) => d.data() as StoryViewItem));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `stories/${story.id}/views`)
    );
    return () => unsub();
  }, [story, isOwner]);

  if (!story) return null;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !replyText.trim()) return;
    const text = replyText.trim();
    setReplyText('');
    try {
      const peer: UserProfile = {
        uid: story.authorId,
        username: story.authorUsername,
        fullName: story.authorName,
        avatarUrl: story.authorAvatar,
        isPrivate: false,
        isVerified: false,
        membershipTier: 'free',
        status: 'active',
        followersCount: 0,
        followingCount: 0,
        friendsCount: 0,
        postsCount: 0,
        createdAt: null,
        updatedAt: null,
      };
      const convId = await getOrCreateDirectConversation(profile, peer);
      await sendChatMessage({
        conversationId: convId,
        sender: profile,
        text: `Replied to your story: ${text}`,
        recipientIds: [story.authorId],
      });
      showToast('Story reply sent via Messenger', 'success');
    } catch {
      showToast('Could not send story reply', 'error');
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    try {
      await deleteDoc(doc(db, 'stories', story.id));
      showToast('Story deleted', 'info');
      onClose();
    } catch {
      showToast('Failed to delete story', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-6">
      <div className="relative w-full max-w-md h-[86vh] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col">
        {/* Progress Indicator */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
          {stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  i < index ? 'w-full bg-white' : i === index ? 'w-full bg-blue-400' : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white">
            <Avatar src={story.authorAvatar} name={story.authorName} size="sm" />
            <div>
              <p className="text-sm font-semibold leading-tight">{story.authorName}</p>
              <p className="text-[11px] text-white/70">
                {formatRelativeTime(story.createdAt, language)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwner && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="p-2 rounded-full bg-black/40 text-white hover:bg-rose-600/80"
                aria-label="Delete story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/70"
              aria-label="Close story viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Content */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center">
          {story.mediaType === 'video' ? (
            <video
              src={story.mediaUrl}
              autoPlay
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={story.mediaUrl}
              alt={story.caption || `${story.authorName}'s story`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

          {story.caption && (
            <p className="absolute bottom-20 left-4 right-4 text-sm text-white text-center drop-shadow">
              {story.caption}
            </p>
          )}

          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70"
              aria-label="Previous story"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {index < stories.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70"
              aria-label="Next story"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Footer: Owner Viewer List OR Reply Bar */}
        <div className="relative z-20 p-3 bg-slate-950 border-t border-slate-800">
          {isOwner ? (
            <div>
              <button
                type="button"
                onClick={() => setShowViewers((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 text-xs font-medium text-white"
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="font-mono-tabular">{story.viewsCount}</span> views
                </span>
                <span className="text-slate-400">{showViewers ? 'Hide' : 'Viewers'}</span>
              </button>
              {showViewers && (
                <div className="mt-2 max-h-36 overflow-y-auto space-y-2 px-1">
                  {viewers.length === 0 ? (
                    <p className="text-xs text-slate-400">No viewers recorded yet.</p>
                  ) : (
                    viewers.map((v) => (
                      <div key={v.viewerId} className="flex items-center gap-2 text-xs text-slate-200">
                        <Avatar src={v.viewerAvatar} name={v.viewerName || 'User'} size="xs" />
                        <span>{v.viewerName || v.viewerId}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleReply} className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${story.authorName}...`}
                maxLength={240}
                className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
