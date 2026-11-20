import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  Compass,
  Film,
  Flame,
  Globe,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PlusSquare,
  Radio,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  User,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Avatar } from './Avatar';
import { PWAInstallButton } from './PWAInstallButton';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, adminRole, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', profile.uid),
      where('isRead', '==', false)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setUnreadNotifs(snap.size),
      () => {}
    );
    return () => unsub();
  }, [profile]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    navigate(`/search?q=${encodeURIComponent(quickSearch.trim())}`);
    setQuickSearch('');
  };

  const primaryNav = [
    { to: '/', label: t('home'), icon: Home },
    { to: '/explore', label: t('explore'), icon: Compass },
    { to: '/reels', label: t('reels'), icon: Film },
    { to: '/stories', label: t('stories'), icon: Flame },
    { to: '/friends', label: t('friends'), icon: Users },
    { to: '/messages', label: t('messages'), icon: MessageSquare },
    { to: '/notifications', label: t('notifications'), icon: Bell, badge: unreadNotifs },
    { to: '/groups', label: t('groups'), icon: UsersRound },
    { to: '/saved', label: t('saved'), icon: Bookmark },
    { to: '/live', label: t('live'), icon: Radio },
    { to: '/creator', label: t('creatorDashboard'), icon: LayoutDashboard },
    { to: '/premium', label: t('premium'), icon: Sparkles },
  ];

  const secondaryNav = [
    { to: '/settings', label: t('settings'), icon: Settings },
    { to: '/privacy', label: t('privacyCenter'), icon: Shield },
    { to: '/help', label: t('helpCenter'), icon: HelpCircle },
  ];

  const mobileTabs = [
    { to: '/', label: t('home'), icon: Home },
    { to: '/reels', label: t('reels'), icon: Film },
    { to: '/create', label: t('create'), icon: PlusSquare },
    { to: '/messages', label: t('messages'), icon: MessageSquare },
    { to: '/notifications', label: t('notifications'), icon: Bell, badge: unreadNotifs },
  ];

  const isImmersiveReels = location.pathname === '/reels';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Compact Sticky Top Bar (Desktop + Mobile <=56px) */}
      <header className="sticky top-0 z-30 h-14 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B1221]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="SK World"
                className="w-8 h-8 rounded-xl object-cover"
              />
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                {t('brand')}
              </span>
            </Link>
          </div>

          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder={`${t('search')} SK World...`}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 pl-10 pr-4 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-950"
            />
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/search"
              aria-label="Search"
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <Search className="w-5 h-5" />
            </Link>
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              aria-label="Switch language"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[36px]"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'en' ? 'BN' : 'EN'}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[38px] min-h-[38px] flex items-center justify-center"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {profile && (
              <Link
                to={`/profile/${profile.username}`}
                className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar src={profile.avatarUrl} name={profile.fullName} size="xs" verified={profile.isVerified} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Responsive Workspace */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200 dark:border-slate-800/80 py-5 px-3 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto justify-between">
          <div className="space-y-1">
            <Link
              to="/create"
              className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white py-2.5 px-4 text-sm font-semibold shadow-sm transition-all"
            >
              <PlusSquare className="w-4 h-4" />
              <span>{t('create')}</span>
            </Link>

            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`
                  }
                >
                  <span className="flex items-center gap-3 truncate">
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span className="font-mono-tabular text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}

            {adminRole && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-semibold'
                      : 'text-violet-700 dark:text-violet-400 hover:bg-violet-50/70 dark:hover:bg-violet-950/30'
                  }`
                }
              >
                <Shield className="w-[18px] h-[18px] shrink-0" />
                <span>{t('admin')}</span>
              </NavLink>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{t('signOut')}</span>
            </button>
          </div>
        </aside>

        {/* Main Page Content */}
        <main
          className={`flex-1 min-w-0 ${
            isImmersiveReels ? 'pb-16 lg:pb-0' : 'px-4 sm:px-6 py-5 pb-24 lg:pb-8'
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile Drawer Menu */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-[#0B1221] h-full p-5 overflow-y-auto flex flex-col justify-between border-r border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <img src="/pwa-192x192.png" alt="SK World" className="w-8 h-8 rounded-xl" />
                  <span className="font-display font-bold text-slate-900 dark:text-white">
                    {t('brand')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {profile && (
                <Link
                  to={`/profile/${profile.username}`}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4"
                >
                  <Avatar src={profile.avatarUrl} name={profile.fullName} size="sm" verified={profile.isVerified} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {profile.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">@{profile.username}</p>
                  </div>
                </Link>
              )}

              <div className="space-y-1">
                {primaryNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                            : 'text-slate-700 dark:text-slate-300'
                        }`
                      }
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge ? (
                        <span className="font-mono-tabular text-xs font-semibold text-blue-600">
                          {item.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
                {adminRole && (
                  <NavLink
                    to="/admin"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-violet-600"
                  >
                    <Shield className="w-4 h-4" />
                    <span>{t('admin')}</span>
                  </NavLink>
                )}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
              <div className="pb-2">
                <PWAInstallButton />
              </div>
              {secondaryNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              <Link
                to="/about"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                <User className="w-4 h-4" />
                <span>{t('about')}</span>
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-rose-600"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Tab Bar (56px height + 56px top bar = 112px <= 15% cap on modern screens) */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B1221]/95 backdrop-blur-md grid grid-cols-5 items-center"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center h-full text-[10px] font-medium ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="mt-0.5 truncate max-w-[60px]">{tab.label}</span>
              {tab.badge ? (
                <span className="absolute top-1.5 right-4 font-mono-tabular text-[10px] font-bold text-rose-600">
                  {tab.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
