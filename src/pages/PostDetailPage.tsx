import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { PostItem } from '../types/skworld';
import { PostCard } from '../components/PostCard';

export const PostDetailPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!postId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    const unsub = onSnapshot(
      doc(db, 'posts', postId),
      (snap) => {
        if (!snap.exists()) {
          setPost(null);
          setNotFound(true);
        } else {
          setPost({ id: snap.id, ...(snap.data() as Omit<PostItem, 'id'>) });
          setNotFound(false);
        }
        setLoading(false);
      },
      (err) => {
        setNotFound(true);
        setLoading(false);
        handleFirestoreError(err, OperationType.GET, `posts/${postId}`);
      }
    );
    return () => unsub();
  }, [postId]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <Link to="/" className="text-xs font-semibold text-blue-600 hover:underline">
          Home Feed
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
          <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-48 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      ) : notFound || !post ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Post not available</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This post may have been deleted or set to private by its author.
          </p>
          <Link
            to="/"
            className="inline-block rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold"
          >
            Return to Home Feed
          </Link>
        </div>
      ) : (
        <PostCard post={post} defaultShowComments />
      )}
    </div>
  );
};
