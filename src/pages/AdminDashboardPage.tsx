import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Megaphone,
  Shield,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { formatRelativeTime } from '../lib/i18n';
import { adminAssignRole, adminUpdateUser, logAdminAction } from '../services/skworldService';
import type {
  AdminRoleType,
  AuditLogItem,
  PostItem,
  ReportItem,
  UserProfile,
} from '../types/skworld';
import { Avatar } from '../components/Avatar';

export const AdminDashboardPage: React.FC = () => {
  const { profile, adminRole } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [adminDocs, setAdminDocs] = useState<Array<{ uid: string; role: AdminRoleType }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [publishingAnn, setPublishingAnn] = useState(false);

  const loadData = async () => {
    try {
      const usersQuery =
        adminRole === 'super_admin'
          ? query(collection(db, 'users'), limit(100))
          : query(collection(db, 'users'), where('status', '==', 'active'), limit(100));
      const userSnap = await getDocs(usersQuery);
      setUsers(userSnap.docs.map((d) => d.data() as UserProfile));
    } catch {
      // Ignored if scope restricted
    }

    try {
      const postsQuery =
        adminRole === 'super_admin'
          ? query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(40))
          : query(collection(db, 'posts'), where('visibility', '==', 'public'), limit(40));
      const postSnap = await getDocs(postsQuery);
      setPosts(postSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, 'id'>) })));
    } catch {
      // Ignored
    }

    if (adminRole === 'super_admin') {
      try {
        const repSnap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(60)));
        setReports(repSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportItem, 'id'>) })));
      } catch {
        // Ignored
      }

      try {
        const logSnap = await getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(50)));
        setAuditLogs(logSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogItem, 'id'>) })));
      } catch {
        // Ignored
      }

      try {
        const admSnap = await getDocs(collection(db, 'admins'));
        setAdminDocs(admSnap.docs.map((d) => d.data() as { uid: string; role: AdminRoleType }));
      } catch {
        // Ignored
      }
    }
  };

  useEffect(() => {
    if (adminRole) {
      void loadData();
    }
  }, [adminRole]);

  if (!adminRole) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
        <Shield className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Access Restricted</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Administrator or Moderator privileges are required to view the SK World Governance Console.
        </p>
      </div>
    );
  }

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !annTitle.trim() || !annBody.trim()) return;
    setPublishingAnn(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: annTitle.trim().slice(0, 120),
        body: annBody.trim().slice(0, 500),
        authorId: profile.uid,
        createdAt: serverTimestamp(),
      });
      await logAdminAction(profile.uid, 'publish_announcement', 'announcements', annTitle.trim());
      setAnnTitle('');
      setAnnBody('');
      showToast('Platform announcement published.', 'success');
      void loadData();
    } catch {
      showToast('Failed to publish announcement.', 'error');
    } finally {
      setPublishingAnn(false);
    }
  };

  const handleReportStatus = async (report: ReportItem, status: 'resolved' | 'dismissed') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        profile.uid,
        `report_${status}`,
        report.id,
        `${status} report on ${report.targetType} ${report.targetId}`
      );
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status } : r)));
      showToast(`Report marked as ${status}.`, 'success');
    } catch {
      showToast('Could not update report status.', 'error');
    }
  };

  const handleRemovePost = async (postId: string) => {
    if (!profile) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      await logAdminAction(profile.uid, 'admin_delete_post', postId, 'Removed post from moderation console');
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast('Post removed.', 'info');
    } catch {
      showToast('Could not remove post.', 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  const adminRoleMap = new Map(adminDocs.map((a) => [a.uid, a.role]));
  const pendingReports = reports.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t('admin')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Role: <strong className="uppercase text-violet-600 dark:text-violet-400">{adminRole.replace('_', ' ')}</strong> · Content moderation, RBAC, and announcements.
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Registered Users</p>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {users.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Recent Public Posts</p>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {posts.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Pending Reports</p>
          <p className="font-mono-tabular text-2xl font-bold text-rose-600 mt-1">
            {pendingReports.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Audit Events</p>
          <p className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {auditLogs.length}
          </p>
        </div>
      </div>

      {/* Publish Announcement */}
      <form
        onSubmit={handlePublishAnnouncement}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
      >
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
          <Megaphone className="w-4 h-4 text-blue-600" />
          <span>Publish Platform Announcement</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            maxLength={120}
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            placeholder="Announcement title"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
          />
          <input
            type="text"
            required
            maxLength={500}
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
            placeholder="Message shown in Home Feed banner..."
            className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={publishingAnn}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 text-xs font-semibold"
          >
            {publishingAnn ? 'Publishing...' : 'Broadcast Announcement'}
          </button>
        </div>
      </form>

      {/* User Management & RBAC */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            User Moderation & RBAC
          </h2>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by name or @username..."
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
          {filteredUsers.map((u) => {
            const assignedRole = adminRoleMap.get(u.uid);
            return (
              <div key={u.uid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={u.avatarUrl} name={u.fullName} size="sm" verified={u.isVerified} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {u.fullName}{' '}
                      <span className="text-xs font-normal text-slate-500">@{u.username}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Status: <strong className={u.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}>{u.status}</strong> · Tier: {u.membershipTier}
                      {assignedRole ? ` · Role: ${assignedRole}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      profile &&
                      void adminUpdateUser(
                        profile.uid,
                        u.uid,
                        { isVerified: !u.isVerified },
                        `${!u.isVerified ? 'Verified' : 'Unverified'} @${u.username}`
                      ).then(() => void loadData())
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{u.isVerified ? 'Unverify' : 'Verify'}</span>
                  </button>

                  {u.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() =>
                        profile &&
                        void adminUpdateUser(
                          profile.uid,
                          u.uid,
                          { status: 'suspended' },
                          `Suspended @${u.username}`
                        ).then(() => void loadData())
                      }
                      className="rounded-xl border border-amber-200 dark:border-amber-900/60 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        profile &&
                        void adminUpdateUser(
                          profile.uid,
                          u.uid,
                          { status: 'active' },
                          `Restored @${u.username}`
                        ).then(() => void loadData())
                      }
                      className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                    >
                      Restore
                    </button>
                  )}

                  {adminRole === 'super_admin' && u.uid !== profile?.uid && (
                    <select
                      value={assignedRole || ''}
                      onChange={async (e) => {
                        if (!profile) return;
                        const val = e.target.value as AdminRoleType | '';
                        if (!val) {
                          await deleteDoc(doc(db, 'admins', u.uid));
                          await logAdminAction(profile.uid, 'revoke_admin_role', u.uid, `Revoked admin role from @${u.username}`);
                        } else {
                          await adminAssignRole(profile.uid, u.uid, val);
                        }
                        showToast('Role updated.', 'success');
                        void loadData();
                      }}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <option value="">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="support">Support</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reports Queue & Content Removal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Moderation Reports Queue
            </h2>
            <span className="font-mono-tabular text-xs text-slate-500">{reports.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {reports.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">
                No moderation reports in queue.
              </p>
            ) : (
              reports.map((rep) => (
                <div key={rep.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white uppercase">
                      {rep.targetType} · {rep.category}
                    </span>
                    <span className="font-mono-tabular text-slate-500">{rep.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Target: {rep.targetId} {rep.details ? `— ${rep.details}` : ''}
                  </p>
                  {rep.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleReportStatus(rep, 'resolved')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-xs font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReportStatus(rep, 'dismissed')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Recent Posts & Audit Log
            </h2>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {posts.slice(0, 12).map((post) => (
              <div key={post.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    @{post.authorUsername}: {post.content || `[${post.mediaType}]`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatRelativeTime(post.createdAt, language)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemovePost(post.id)}
                  aria-label="Remove post"
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="p-3.5 bg-slate-50/50 dark:bg-slate-950/30">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {log.action} · <span className="font-normal text-slate-500">{log.details}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
