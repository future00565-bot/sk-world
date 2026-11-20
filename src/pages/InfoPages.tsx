import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, HelpCircle, LifeBuoy, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { submitReport } from '../services/skworldService';

const FAQS = [
  {
    q: 'How do 24-hour Stories work on SK World?',
    a: 'Every Story expires automatically 24 hours after publication. Only you, the Story creator, can inspect the viewer list and view counts.',
  },
  {
    q: 'Who can see my email address or phone number?',
    a: 'Your email, phone number, date of birth, and preferences are stored in an isolated private document readable strictly by your authenticated session.',
  },
  {
    q: 'How can I install SK World as a mobile or desktop app?',
    a: 'SK World is an installable Progressive Web App. Click the Install App button in the header or use your browser menu ("Add to Home Screen" or "Install SK World").',
  },
  {
    q: 'How do I report abusive content or appeal a moderation decision?',
    a: 'Use the flag icon on any post, Reel, Story, or profile to submit a safety report, or use the Moderation Appeal form below.',
  },
];

export const HelpCenterPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [appealText, setAppealText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredFaqs = FAQS.filter(
    (item) =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !appealText.trim()) return;
    setSubmitting(true);
    try {
      await submitReport({
        reporterId: firebaseUser.uid,
        targetType: 'profile',
        targetId: firebaseUser.uid,
        category: 'other',
        details: `[Help / Moderation Appeal] ${appealText.trim()}`,
      });
      setAppealText('');
      showToast('Your support request has been routed to SK World moderators.', 'success');
    } catch {
      showToast('Could not submit request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Help Center & Community Guidelines
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Safety standards, answers to common questions, and moderation appeals.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search help articles..."
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
      />

      <div className="space-y-3">
        {filteredFaqs.map((faq) => (
          <div
            key={faq.q}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
          >
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{faq.q}</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
          <LifeBuoy className="w-4 h-4 text-violet-600" />
          <span>Contact Support / Moderation Appeal</span>
        </div>
        <form onSubmit={handleSubmitAppeal} className="space-y-3">
          <textarea
            rows={3}
            required
            maxLength={900}
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="Describe your question, bug report, or moderation appeal..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={submitting || !appealText.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 text-xs font-semibold"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Sending...' : 'Submit Request'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export const AboutPage: React.FC = () => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4">
      <div className="flex items-center gap-3">
        <img src="/pwa-192x192.png" alt="SK World" className="w-12 h-12 rounded-2xl" />
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            About SK World
          </h1>
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            Connect. Share. Explore. Together.
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        SK World is a next-generation social networking platform uniting dynamic community feeds, full-screen vertical Reels, 24-hour Stories, real-time Messenger, and creator communities in a fast, bilingual (English & Bengali), privacy-first web and Progressive Web App experience.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
          <ShieldCheck className="w-5 h-5 text-blue-600 mb-2" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Privacy Architecture</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personal credentials and preferences are isolated from public profile reads and enforced at the database rules layer.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
          <BookOpen className="w-5 h-5 text-violet-600 mb-2" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Legal & Policies</h2>
          <div className="flex items-center gap-3 mt-2 text-xs font-medium text-blue-600">
            <Link to="/terms" className="hover:underline">Terms & Conditions</Link>
            <span>·</span>
            <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="max-w-3xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4">
    <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
      Terms & Conditions
    </h1>
    <p className="text-xs text-slate-500">Effective Date: November 2026</p>
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
      <p>
        <strong>1. Acceptable Use:</strong> By accessing SK World, you agree not to publish spam, harassment, hate speech, non-consensual content, impersonation, or copyright-infringing media.
      </p>
      <p>
        <strong>2. Account Ownership:</strong> You are responsible for maintaining the security of your verified authentication credentials and any content shared through your profile.
      </p>
      <p>
        <strong>3. Moderation & Enforcement:</strong> SK World moderators may remove violating posts, Reels, Stories, or suspend accounts that breach Community Guidelines. You may appeal decisions through the Help Center.
      </p>
      <p>
        <strong>4. Paid Memberships:</strong> Where Stripe Checkout is enabled, subscriptions renew according to the billing cycle displayed at checkout and can be cancelled prior to renewal.
      </p>
    </div>
  </div>
);

export const PrivacyPolicyPage: React.FC = () => (
  <div className="max-w-3xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4">
    <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
      Privacy Policy
    </h1>
    <p className="text-xs text-slate-500">Effective Date: November 2026</p>
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
      <p>
        <strong>1. Data Collection & Isolation:</strong> SK World stores your public profile (name, username, bio, avatar) separately from private account data (email address, optional phone number, date of birth, theme, and language preferences).
      </p>
      <p>
        <strong>2. Stories & Messaging Privacy:</strong> Stories automatically expire 24 hours after creation. Story viewer lists are strictly restricted to the Story author. Conversation messages are accessible only to verified conversation members.
      </p>
      <p>
        <strong>3. User Controls:</strong> You can switch your account to Private, hide your online presence / last seen status, restrict incoming messages, block specific users, or permanently delete your account from Settings & Privacy Center.
      </p>
    </div>
  </div>
);
