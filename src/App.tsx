/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertOctagon, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthGate } from './components/AuthGate';
import { AppShell } from './components/AppShell';
import { HomeFeedPage } from './pages/HomeFeedPage';
import { ExplorePage } from './pages/ExplorePage';
import { ReelsPage } from './pages/ReelsPage';
import { StoriesPage } from './pages/StoriesPage';
import { FriendsPage } from './pages/FriendsPage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { CreatePostPage } from './pages/CreatePostPage';
import { SearchPage } from './pages/SearchPage';
import { GroupsPage } from './pages/GroupsPage';
import { SavedPage } from './pages/SavedPage';
import { LivePage } from './pages/LivePage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { PremiumPage } from './pages/PremiumPage';
import { SettingsPrivacyPage } from './pages/SettingsPrivacyPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { PostDetailPage } from './pages/PostDetailPage';
import { AboutPage, HelpCenterPage, PrivacyPolicyPage, TermsPage } from './pages/InfoPages';

const PUBLIC_INFO_PATHS = new Set(['/terms', '/privacy-policy', '/about']);

const AppRouter: React.FC = () => {
  const { firebaseUser, profile, authReady, needsOnboarding, logout } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070B14]">
        <div className="flex flex-col items-center gap-3">
          <img src="/pwa-192x192.png" alt="SK World" className="w-12 h-12 rounded-2xl animate-pulse" />
          <p className="text-xs font-medium text-slate-500">Loading SK World...</p>
        </div>
      </div>
    );
  }

  // Allow reading public policy pages even before completing sign-in
  if ((!firebaseUser || !firebaseUser.emailVerified || needsOnboarding || !profile) && PUBLIC_INFO_PATHS.has(location.pathname)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070B14] px-4 py-8">
        <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/pwa-192x192.png" alt="SK World" className="w-8 h-8 rounded-xl" />
            <span className="font-display font-bold text-slate-900 dark:text-white">SK World</span>
          </Link>
          <Link
            to="/"
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold"
          >
            Back to Sign In
          </Link>
        </div>
        <Routes>
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        </Routes>
      </div>
    );
  }

  if (!firebaseUser || !firebaseUser.emailVerified || needsOnboarding || !profile) {
    return <AuthGate />;
  }

  if (profile.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070B14] p-6">
        <div className="max-w-md w-full rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
          <AlertOctagon className="w-10 h-10 text-rose-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Account {profile.status === 'banned' ? 'Banned' : 'Suspended'}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your SK World account (@{profile.username}) is currently {profile.status} due to a Community Guidelines violation.
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white px-5 py-2.5 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomeFeedPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/settings/profile" element={<EditProfilePage />} />
        <Route path="/create" element={<CreatePostPage />} />
        <Route path="/post/:postId" element={<PostDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/creator" element={<CreatorDashboardPage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/settings" element={<SettingsPrivacyPage />} />
        <Route path="/privacy" element={<SettingsPrivacyPage />} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <OfflineIndicator />
                <AppRouter />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
