import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skworld.app',
  appName: 'SK World',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'gen-lang-client-0640549079.firebaseapp.com',
      'accounts.google.com',
      'hjkwzsizfeeyelsxbwto.supabase.co',
      'ais-pre-yybvx52dcc4msdotdwf2mt-997736304901.asia-southeast1.run.app',
      'ais-dev-yybvx52dcc4msdotdwf2mt-997736304901.asia-southeast1.run.app',
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
