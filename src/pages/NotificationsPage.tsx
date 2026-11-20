import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatRelativeTime } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NotificationItem } from '../types/skworld';
import { Avatar } from '../components/Avatar';

export const NotificationsPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    let fallbackUnsub: (() => void) | null = null;
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }))),
      () => {
        fallbackUnsub = onSnapshot(
          query(collection(db, 'notifications'), where('recipientId', '==', firebaseUser.uid)),
          (snap2) => {
            const list = snap2.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }));
            list.sort((a, b) => {
              const ta = (a.createdAt as { toMillis?: () => number } | null)?.toMillis?.() || 0;
              const tb = (b.createdAt as { toMillis?: () => number } | null)?.toMillis?.() || 0;
              return tb - ta;
            });
            setItems(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        );
      }
    );
    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [firebaseUser]);

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { isRead: true }));
    await batch.commit();
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.isRead) {
      void updateDoc(doc(db, 'notifications', n.id), { isRead: true }).catch(() => {});
    }
    if ((n.type === 'like' || n.type === 'comment' || n.type === 'reply' || n.type === 'mention') && n.targetId) {
      navigate(`/post/${n.targetId}`);
    } else if ((n.type === 'follow' || n.type === 'friend_accept') && (n.targetId || n.actorId)) {
      navigate(`/profile/${n.targetId || n.actorId}`);
    } else if (n.type === 'friend_request') {
      navigate('/friends?tab=requests');
    } else if (n.type === 'message' || n.type === 'story_reply') {
      navigate(n.targetId ? `/messages?c=${n.targetId}` : '/messages');
    } else if (n.type === 'group_invite') {
      navigate('/groups');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            {t('notifications')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time alerts for likes, comments, follows, friend requests, and messages.
          </p>
        </div>
        {items.some((n) => !n.isRead) && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <CheckCheck className="w-4 h-4 text-blue-600" />
            {t('markAllRead')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
          You are all caught up. No notifications yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`flex items-center justify-between gap-3 p-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                !n.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={n.actorAvatar} name={n.actorName || 'SK'} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-100">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {n.type.replace('_', ' ')} · {formatRelativeTime(n.createdAt, language)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteDoc(doc(db, 'notifications', n.id));
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600"
                aria-label="Delete notification"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
