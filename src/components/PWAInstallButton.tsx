import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../contexts/LanguageContext';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { t } = useLanguage();

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4" />
        {!compact && <span>{t('installApp')}</span>}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Smartphone className="w-4 h-4 text-blue-600" />
          {!compact && <span>{t('installApp')}</span>}
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Install SK World on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> to launch SK World as an app.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-900 dark:bg-blue-600 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
