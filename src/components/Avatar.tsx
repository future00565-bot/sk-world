import React, { useState } from 'react';
import { BadgeCheck } from 'lucide-react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  verified?: boolean;
  online?: boolean;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  verified = false,
  online = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = (name || 'SK')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className={`relative inline-flex shrink-0 ${SIZE_MAP[size]}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white font-semibold flex items-center justify-center border border-slate-200/40 dark:border-slate-700">
          {initials || 'SK'}
        </div>
      )}
      {online && (
        <span
          aria-label="Online"
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
        />
      )}
      {verified && !online && (
        <span
          aria-label="Verified profile"
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-slate-900 p-0.5 text-blue-600"
        >
          <BadgeCheck className="w-3.5 h-3.5 fill-blue-600 text-white" />
        </span>
      )}
    </div>
  );
};
