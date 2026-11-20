import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Globe,
  Lock,
  Monitor,
  Moon,
  Shield,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { toggleBlockUser } from '../services/skworldService';
import type { LanguageCode, ThemeMode, UserPrivateInfo, UserProfile } from '../types/skworld';
import { Avatar } from '../components/Avatar';

export const SettingsPrivacyPage: React.FC = () => {
  const { profile, privateInfo, firebaseUser, deleteAccount } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [isPrivate, setIsPrivate] = useState(profile?.isPrivate ?? false);
  const [allowMessagesFrom, setAllowMessagesFrom] = useState<UserPrivateInfo['allowMessagesFrom']>(
    privateInfo?.allowMessagesFrom ?? 'everyone'
  );
  const [showLastSeen, setShowLastSeen] = useState(privateInfo?.showLastSeen ?? true);
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) setIsPrivate(profile.isPrivate);
  }, [profile]);

  useEffect(() => {
    if (privateInfo) {
      setAllowMessagesFrom(privateInfo.allowMessagesFrom);
      setShowLastSeen(privateInfo.showLastSeen);
    }
  }, [privateInfo]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'blocks'), where('blockerId', '==', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const ids = snap.docs.map((d) => (d.data() as { blockedId: string }).blockedId);
        const loaded = await Promise.all(
          ids.map(async (id) => {
            const uSnap = await getDoc(doc(db, 'users', id));
            return uSnap.exists() ? (uSnap.data() as UserProfile) : null;
          })
        );
        setBlockedUsers(loaded.filter((u): u is UserProfile => Boolean(u)));
      },
      () => {}
    );
    return () => unsub();
  }, [firebaseUser]);

  const persistPrivatePreferences = async (patch: {
    theme?: ThemeMode;
    language?: LanguageCode;
    allowMessagesFrom?: UserPrivateInfo['allowMessagesFrom'];
    showLastSeen?: boolean;
  }) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    try {
      await setDoc(
        doc(db, 'users', uid, 'private', 'info'),
        {
          uid,
          email: privateInfo?.email || firebaseUser.email || '',
          phone: privateInfo?.phone || '',
          dateOfBirth: privateInfo?.dateOfBirth || '',
          allowMessagesFrom: patch.allowMessagesFrom ?? allowMessagesFrom,
          showLastSeen: patch.showLastSeen ?? showLastSeen,
          language: patch.language ?? language,
          theme: patch.theme ?? theme,
          termsAcceptedAt: privateInfo?.termsAcceptedAt || new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/info`);
    }
  };

  const handleSavePrivacy = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isPrivate,
        updatedAt: serverTimestamp(),
      });
      await persistPrivatePreferences({ allowMessagesFrom, showLastSeen });
      showToast('Privacy preferences saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save privacy settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeSelect = async (next: ThemeMode) => {
    setTheme(next);
    await persistPrivatePreferences({ theme: next });
    showToast(`Appearance set to ${next}`, 'success');
  };

  const handleLanguageSelect = async (next: LanguageCode) => {
    setLanguage(next);
    await persistPrivatePreferences({ language: next });
    showToast(next === 'bn' ? 'ভাষা বাংলায় পরিবর্তন করা হয়েছে' : 'Language switched to English', 'success');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      showToast('Account deleted.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error && err.message.includes('requires-recent-login')
          ? 'Please sign out and sign back in recently before deleting your account.'
          : err instanceof Error
            ? err.message
            : 'Could not delete account.',
        'error'
      );
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t('settings')} & {t('privacyCenter')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage appearance, language, message privacy, blocked accounts, and data controls.
          </p>
        </div>
        <Link
          to="/settings/profile"
          className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {t('editProfile')}
        </Link>
      </div>

      {/* Appearance & Language */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('theme')}</h2>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { id: 'light', label: t('lightMode'), icon: Sun },
                { id: 'dark', label: t('darkMode'), icon: Moon },
                { id: 'system', label: t('systemMode'), icon: Monitor },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => void handleThemeSelect(opt.id)}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    theme === opt.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('language')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void handleLanguageSelect('en')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium ${
                language === 'en'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>English</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLanguageSelect('bn')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium ${
                language === 'bn'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>বাংলা (Bengali)</span>
            </button>
          </div>
        </div>
      </section>

      {/* Privacy & Messaging Controls */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Privacy Controls</span>
        </div>

        <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">Private Account</p>
            <p className="text-xs text-slate-500">
              Restrict visibility of your private posts to approved followers and friends.
            </p>
          </div>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-5 h-5 accent-blue-600"
          />
        </label>

        <label className="flex items-center justify-between gap-4 py-2 border-t border-slate-100 dark:border-slate-800 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Show Online Presence & Last Seen
            </p>
            <p className="text-xs text-slate-500">
              Allow contacts in Messenger to see when you are active on SK World.
            </p>
          </div>
          <input
            type="checkbox"
            checked={showLastSeen}
            onChange={(e) => setShowLastSeen(e.target.checked)}
            className="w-5 h-5 accent-blue-600"
          />
        </label>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">Who can message you</p>
            <p className="text-xs text-slate-500">Control direct message permissions.</p>
          </div>
          <select
            value={allowMessagesFrom}
            onChange={(e) =>
              setAllowMessagesFrom(e.target.value as UserPrivateInfo['allowMessagesFrom'])
            }
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers</option>
            <option value="friends">Friends only</option>
          </select>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSavePrivacy()}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-semibold"
          >
            {saving ? 'Saving...' : 'Save Privacy Settings'}
          </button>
        </div>
      </section>

      {/* Blocked Accounts */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
          <Ban className="w-4 h-4 text-rose-600" />
          <span>Blocked Users ({blockedUsers.length})</span>
        </div>
        {blockedUsers.length === 0 ? (
          <p className="text-xs text-slate-500">You have not blocked anyone.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {blockedUsers.map((user) => (
              <div key={user.uid} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={user.avatarUrl} name={user.fullName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {user.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => profile && void toggleBlockUser(profile.uid, user.uid, true)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Account Data & Deletion */}
      <section className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
            <Lock className="w-4 h-4" />
            <span>Delete Account</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Permanently remove your private credentials, username reservation, and sign-in access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold shrink-0"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Account</span>
        </button>
      </section>

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Account Deletion
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This action permanently deletes your private settings, releases your @{profile?.username} handle, and revokes authentication access. This cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteAccount()}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-semibold"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
