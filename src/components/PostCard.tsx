import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Bookmark,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatRelativeTime } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  addPostComment,
  deletePost,
  deletePostComment,
  incrementPostShare,
  togglePostLike,
  toggleSavedItem,
  updatePost,
} from '../services/skworldService';
import type { CommentItem, PostItem, VisibilityType } from '../types/skworld';
import { Avatar } from './Avatar';
import { ReportModal } from './ReportModal';

interface PostCardProps {
  post: PostItem;
  isSavedInitial?: boolean;
  defaultShowComments?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isSavedInitial,
  defaultShowComments = false,
}) => {
  const { profile, firebaseUser } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(Boolean(isSavedInitial));
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editLocation, setEditLocation] = useState(post.location || '');
  const [editVisibility, setEditVisibility] = useState<VisibilityType>(post.visibility);
  const [reportOpen, setReportOpen] = useState(false);
  const [busyLike, setBusyLike] = useState(false);

  const isOwner = firebaseUser?.uid === post.authorId;

  useEffect(() => {
    if (typeof isSavedInitial === 'boolean') {
      setSaved(isSavedInitial);
    } else if (firebaseUser) {
      getDoc(doc(db, 'saved_posts', `${firebaseUser.uid}_${post.id}`))
        .then((snap) => setSaved(snap.exists()))
        .catch(() => {});
    }
  }, [isSavedInitial, post.id, firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    getDoc(doc(db, 'posts', post.id, 'likes', firebaseUser.uid))
      .then((snap) => setLiked(snap.exists()))
      .catch(() => {});
  }, [post.id, firebaseUser]);

  useEffect(() => {
    if (!showComments) return;
    const q = query(
      collection(db, 'posts', post.id, 'comments'),
      where('targetId', '==', post.id)
    );
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
        handleFirestoreError(err, OperationType.LIST, `posts/${post.id}/comments`);
      }
    );
    return () => unsub();
  }, [post.id, showComments]);

  const handleLike = async () => {
    if (!profile || busyLike) return;
    setBusyLike(true);
    const prev = liked;
    setLiked(!prev);
    try {
      await togglePostLike(post, profile, prev);
    } catch {
      setLiked(prev);
      showToast('Unable to update reaction.', 'error');
    } finally {
      setBusyLike(false);
    }
  };

  const handleSave = async () => {
    if (!firebaseUser) return;
    const prev = saved;
    setSaved(!prev);
    try {
      await toggleSavedItem(firebaseUser.uid, post.id, 'post', prev);
      showToast(!prev ? 'Saved to your collection' : 'Removed from saved', 'success');
    } catch {
      setSaved(prev);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.authorName} on SK World`, text: post.content.slice(0, 120), url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Post link copied to clipboard', 'success');
      }
      await incrementPostShare(post.id);
    } catch {
      // User cancelled share dialog
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    try {
      await addPostComment(post, profile, text, replyTo?.id || '');
      setReplyTo(null);
    } catch {
      showToast('Could not post comment', 'error');
    }
  };

  const handleEditSave = async () => {
    if (!editContent.trim() && (!post.mediaUrls || post.mediaUrls.length === 0)) return;
    try {
      await updatePost(post.id, {
        content: editContent,
        location: editLocation,
        visibility: editVisibility,
      });
      setEditing(false);
      showToast('Post updated', 'success');
    } catch {
      showToast('Failed to update post', 'error');
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    try {
      await deletePost(post.id, post.authorId);
      showToast('Post deleted', 'info');
    } catch {
      showToast('Failed to delete post', 'error');
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 transition-colors">
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/profile/${post.authorUsername}`} className="shrink-0">
              <Avatar src={post.authorAvatar} name={post.authorName} size="md" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  to={`/profile/${post.authorUsername}`}
                  className="font-semibold text-sm text-slate-900 dark:text-white hover:underline truncate"
                >
                  {post.authorName}
                </Link>
                {post.authorVerified && (
                  <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">@{post.authorUsername}</span>
                <span aria-hidden="true">·</span>
                <Link to={`/post/${post.id}`} className="whitespace-nowrap hover:underline">
                  {formatRelativeTime(post.createdAt, language)}
                </Link>
                {post.location && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {post.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Post options"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 z-20">
                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4" /> Edit Post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleDelete();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Post
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Flag className="w-4 h-4 text-amber-600" /> {t('report')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body / Edit Mode */}
        {editing ? (
          <div className="mt-3 space-y-3">
            <textarea
              rows={3}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={5000}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value as VisibilityType)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="friends">Friends</option>
                  <option value="private">Only Me</option>
                </select>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  maxLength={100}
                  placeholder="Location"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleEditSave()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        ) : (
          post.content && (
            <p className="mt-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
              {post.content.split(/(#[a-zA-Z0-9_\u0980-\u09FF]+)/g).map((part, idx) =>
                part.startsWith('#') ? (
                  <Link
                    key={idx}
                    to={`/search?q=${encodeURIComponent(part.slice(1))}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {part}
                  </Link>
                ) : (
                  <React.Fragment key={idx}>{part}</React.Fragment>
                )
              )}
            </p>
          )
        )}

        {/* Media Gallery */}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div
            className={`mt-3 grid gap-2 overflow-hidden rounded-xl ${
              post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            {post.mediaUrls.map((url, idx) =>
              post.mediaType === 'video' ? (
                <video
                  key={idx}
                  src={url}
                  controls
                  preload="metadata"
                  className="w-full max-h-[460px] rounded-xl bg-slate-950 object-contain"
                />
              ) : (
                <img
                  key={idx}
                  src={url}
                  alt={`Post media ${idx + 1}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[460px] object-cover rounded-xl bg-slate-100 dark:bg-slate-800"
                />
              )
            )}
          </div>
        )}

        {/* Action Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => void handleLike()}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-transform active:scale-95 min-h-[40px] ${
                liked
                  ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/30'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-rose-600' : ''}`} />
              <span className="font-mono-tabular text-xs">{post.likesCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-mono-tabular text-xs">{post.commentsCount}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
            >
              <Share2 className="w-4 h-4" />
              <span className="font-mono-tabular text-xs">{post.sharesCount}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            aria-label={saved ? t('savedLabel') : t('save')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium min-h-[40px] ${
              saved
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-blue-600' : ''}`} />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No comments yet. Start the conversation.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-start gap-2.5 ${c.parentCommentId ? 'ml-8' : ''}`}
                  >
                    <Avatar src={c.authorAvatar} name={c.authorName} size="xs" />
                    <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/profile/${c.authorUsername}`}
                          className="text-xs font-semibold text-slate-900 dark:text-white hover:underline"
                        >
                          {c.authorName}
                        </Link>
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(c.createdAt, language)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 mt-0.5 break-words">
                        {c.content}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setReplyTo(c)}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Reply
                        </button>
                        {firebaseUser?.uid === c.authorId && (
                          <button
                            type="button"
                            onClick={() => void deletePostComment(post.id, c.id)}
                            className="text-[11px] font-medium text-rose-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {profile && (
              <form onSubmit={handleCommentSubmit} className="space-y-1.5">
                {replyTo && (
                  <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 px-1">
                    <span>Replying to @{replyTo.authorUsername}</span>
                    <button type="button" onClick={() => setReplyTo(null)} className="hover:underline">
                      Cancel
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    maxLength={1000}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center"
                    aria-label="Send comment"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
      />
    </article>
  );
};
