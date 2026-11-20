import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { uploadMediaFile } from '../lib/mediaUpload';
import { VALIDATION_LIMITS } from '../types/skworld';

export const AuthGate: React.FC = () => {
  const {
    firebaseUser,
    needsOnboarding,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendResetEmail,
    resendVerificationEmail,
    completeOnboarding,
    logout,
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'google' | 'email_login' | 'email_register' | 'reset'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Onboarding fields
  const [fullName, setFullName] = useState(firebaseUser?.displayName || '');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(firebaseUser?.photoURL || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'email_login') {
        await signInWithEmail(email, password);
      } else if (mode === 'email_register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        await signUpWithEmail(email, password);
        showToast('Account created! Please check your inbox to verify your email.', 'success');
      } else if (mode === 'reset') {
        await sendResetEmail(email);
        showToast('Password reset link sent to your email.', 'success');
        setMode('email_login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      if (msg.includes('operation-not-allowed')) {
        showToast(
          'Email/Password login is not enabled in Firebase Console yet. Please use Google Sign-In or enable Email/Password in Authentication -> Sign-in method.',
          'info'
        );
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadMediaFile(file, 'avatars');
      setAvatarUrl(uploaded.url);
      showToast('Profile photo uploaded', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    if (!VALIDATION_LIMITS.USERNAME_REGEX.test(cleanUser)) {
      showToast('Username must be 3-30 characters using letters, numbers, or underscores.', 'error');
      return;
    }
    if (!fullName.trim()) {
      showToast('Please enter your full name.', 'error');
      return;
    }
    if (!acceptedTerms) {
      showToast('Please accept the Terms & Conditions and Privacy Policy.', 'error');
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding({
        fullName,
        username: cleanUser,
        phone,
        dateOfBirth,
        avatarUrl,
      });
      showToast('Welcome to SK World!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not complete setup.', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Screen 1: Unverified Email Gate
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070B14] p-6">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mb-4">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Verify your email</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            We sent a verification link to <strong>{firebaseUser.email}</strong>. Click the link, then refresh this page.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-semibold"
            >
              I have verified my email
            </button>
            <button
              type="button"
              onClick={() => void resendVerificationEmail().then(() => showToast('Verification email resent', 'success'))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Resend verification email
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs text-slate-500 hover:underline mt-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Screen 2: Profile Registration Onboarding
  if (needsOnboarding && firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070B14] p-4 sm:p-6">
        <div className="max-w-lg w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Complete your SK World profile</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Choose your unique handle and personalize your account.
              </p>
            </div>
            <UserCheck className="w-7 h-7 text-blue-600 shrink-0" />
          </div>

          <form onSubmit={handleOnboardingSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <label className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                Upload Profile Photo
                <input type="file" accept="image/*" onChange={(e) => void handleAvatarUpload(e)} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ariyan Rahman"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Unique Username *
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="ariyan_sk"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Phone Number (optional)
                </label>
                <input
                  type="tel"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1XXX-XXXXXX"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-blue-600"
              />
              <span>
                I accept SK World&apos;s Terms & Conditions, Community Guidelines, and Privacy Policy.
              </span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => void logout()}
                className="text-xs font-medium text-slate-500 hover:underline"
              >
                Use another account
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold"
              >
                {busy ? 'Creating profile...' : 'Enter SK World'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Screen 3: Primary Login & Brand Welcome Experience (Full 1440px Responsive Split)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B14] flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/pwa-192x192.png"
            alt="SK World logo"
            className="w-9 h-9 rounded-xl object-cover"
          />
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            {t('brand')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Globe className="w-4 h-4 text-blue-600" />
          <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Editorial Hero */}
        <div className="lg:col-span-7 space-y-6">
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] max-w-xl [text-wrap:balance]">
            {t('tagline')}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
            SK World brings real-time feeds, vertical Reels, 24-hour Stories, encrypted-membership Messenger, and vibrant creator communities into one fast, installable platform.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 max-w-xl">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <Sparkles className="w-5 h-5 text-blue-600 mb-2" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Reels & Stories</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                24-hour expiring moments & full-screen vertical video.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <ShieldCheck className="w-5 h-5 text-violet-600 mb-2" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Privacy First</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Isolated PII storage, granular profile visibility & block controls.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Bilingual & PWA</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Native-feel English & Bengali app installable on mobile & desktop.
              </p>
            </div>
          </div>
        </div>

        {/* Right Sign-In Card */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Sign in to SK World
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Use your Google account for instant verified access, or sign in with email.
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleSignIn()}
              className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-60 text-white py-3 px-4 text-sm font-semibold transition-all shadow-sm min-h-[46px]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>{t('signInGoogle')}</span>
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span>or with email</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setMode('email_login')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  mode === 'email_login' || mode === 'google'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('email_register')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  mode === 'email_register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setMode('reset')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  mode === 'reset'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Recovery
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {mode !== 'reset' && (
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              )}
              {mode === 'email_register' && (
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white py-2.5 text-sm font-medium transition-colors"
              >
                {mode === 'email_register'
                  ? 'Create Email Account'
                  : mode === 'reset'
                    ? 'Send Password Reset'
                    : 'Sign In with Email'}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Secured by Firebase Authentication and strict Firestore rules.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
