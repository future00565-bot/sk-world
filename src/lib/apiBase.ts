import { Capacitor } from '@capacitor/core';

const DEFAULT_REMOTE_API_ORIGIN = 'https://ais-pre-yybvx52dcc4msdotdwf2mt-997736304901.asia-southeast1.run.app';

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  if (Capacitor.isNativePlatform()) {
    return DEFAULT_REMOTE_API_ORIGIN;
  }
  return '';
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
}
