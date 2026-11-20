import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { submitReport } from '../services/skworldService';
import type { ReportItem } from '../types/skworld';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportItem['targetType'];
  targetId: string;
}

const CATEGORIES: Array<{ value: ReportItem['category']; label: string }> = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'bullying', label: 'Bullying or intimidation' },
  { value: 'violence', label: 'Violence or dangerous acts' },
  { value: 'sexual_content', label: 'Inappropriate sexual content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'copyright', label: 'Copyright infringement' },
  { value: 'other', label: 'Other safety concern' },
];

export const ReportModal: React.FC<ReportModalProps> = ({ open, onClose, targetType, targetId }) => {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [category, setCategory] = useState<ReportItem['category']>('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSubmitting(true);
    try {
      await submitReport({
        reporterId: firebaseUser.uid,
        targetType,
        targetId,
        category,
        details,
      });
      showToast('Report submitted to SK World moderation team.', 'success');
      setDetails('');
      onClose();
    } catch {
      showToast('Could not submit report. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <Flag className="w-5 h-5 text-rose-600" />
            <span>Report {targetType}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Select reason
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {CATEGORIES.map((item) => (
                <label
                  key={item.value}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                    category === item.value
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportCategory"
                    value={item.value}
                    checked={category === item.value}
                    onChange={() => setCategory(item.value)}
                    className="accent-blue-600"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Additional context (optional)
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide details for our safety reviewers..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-medium"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
