import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { apiUrl } from '../lib/apiBase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface PaymentConfigStatus {
  paymentsConfigured: boolean;
  paymentsRequiredEnv: string[];
}

export const PremiumPage: React.FC = () => {
  const { profile, getIdToken } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [config, setConfig] = useState<PaymentConfigStatus | null>(null);
  const [busyPlan, setBusyPlan] = useState<'premium' | 'creator_pro' | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/config-status'))
      .then((r) => r.json())
      .then((data: PaymentConfigStatus) => setConfig(data))
      .catch(() => {
        setConfig({
          paymentsConfigured: false,
          paymentsRequiredEnv: [
            'STRIPE_SECRET_KEY',
            'STRIPE_WEBHOOK_SECRET',
            'STRIPE_PRICE_PREMIUM',
            'STRIPE_PRICE_CREATOR_PRO',
          ],
        });
      });
  }, []);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      showToast('Checkout completed! Your membership updates once Stripe webhook confirms.', 'success');
    } else if (checkout === 'cancelled') {
      showToast('Checkout cancelled.', 'info');
    }
  }, [searchParams, showToast]);

  const handleCheckout = async (plan: 'premium' | 'creator_pro') => {
    setBusyPlan(plan);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch(apiUrl('/api/stripe/checkout'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as {
        configured?: boolean;
        url?: string;
        error?: string;
        requiredEnv?: string[];
      };
      if (!res.ok || !data.url) {
        showToast(data.error || 'Stripe checkout is not configured on the server yet.', 'info');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Checkout request failed', 'error');
    } finally {
      setBusyPlan(null);
    }
  };

  const currentTier = profile?.membershipTier || 'free';

  const plans = [
    {
      id: 'free' as const,
      name: 'SK World Standard',
      price: '$0',
      period: 'Forever free',
      desc: 'Everything you need to connect, share posts, watch Reels, and message friends.',
      features: [
        'Unlimited posts, Stories (24h), and Reels',
        '1-on-1 & Group real-time Messenger',
        'Groups & Community discussions',
        'Standard 10MB image / 50MB video uploads',
      ],
    },
    {
      id: 'premium' as const,
      name: 'SK World Premium',
      price: '$4.99',
      period: 'per month',
      desc: 'Enhanced profile identity, verified eligibility review, and creator reach tools.',
      features: [
        'Verified creator badge review priority',
        'Custom profile accent & highlight reels',
        'Ad-free browsing across Feed and Explore',
        'Priority support & moderation appeals',
      ],
    },
    {
      id: 'creator_pro' as const,
      name: 'Creator Pro',
      price: '$12.99',
      period: 'per month',
      desc: 'Built for full-time video creators, live hosts, and growing brand communities.',
      features: [
        'All SK World Premium benefits included',
        'Live Studio room hosting & analytics export',
        'Creator Pro badge on profile and Reels',
        'Early access to monetization & tip jars',
      ],
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t('premium')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Active plan: <strong className="text-slate-900 dark:text-white uppercase">{currentTier.replace('_', ' ')}</strong>
          </p>
        </div>
      </div>

      {config && !config.paymentsConfigured && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold">
              Stripe billing gateway is not configured on this server yet.
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              Membership upgrades require real Stripe Checkout & Webhook signature verification. Set{' '}
              <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                {config.paymentsRequiredEnv.join(', ')}
              </code>{' '}
              in your environment to enable live billing.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const isFeatured = plan.id === 'premium';
          return (
            <div
              key={plan.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between ${
                isFeatured
                  ? 'border-blue-600 bg-white dark:bg-slate-900 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {plan.name}
                  </span>
                  {plan.id === 'creator_pro' ? (
                    <Crown className="w-5 h-5 text-violet-600" />
                  ) : plan.id === 'premium' ? (
                    <Sparkles className="w-5 h-5 text-blue-600" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="font-mono-tabular text-3xl font-extrabold text-slate-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-500">{plan.period}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">{plan.desc}</p>

                <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-xs leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                {isCurrent ? (
                  <div className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Current Plan
                  </div>
                ) : plan.id === 'free' ? (
                  <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-center text-xs font-medium text-slate-500">
                    Included by default
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busyPlan !== null}
                    onClick={() => void handleCheckout(plan.id)}
                    className={`w-full rounded-xl py-2.5 text-xs font-semibold text-white transition-all disabled:opacity-60 ${
                      isFeatured
                        ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700'
                        : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700'
                    }`}
                  >
                    {busyPlan === plan.id ? 'Starting Checkout...' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
