import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.souqjiran.app',
  appName: 'سوق الجيران',
  webDir: 'dist/public',
  plugins: {
    FirebaseAuthentication: {
      providers: ['phone'],
    },
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;
