
import { initializeApp, getApps, getApp, AppOptions } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  let config: AppOptions | undefined = undefined;
  try {
    if (process.env.FIREBASE_CONFIG) {
        config = JSON.parse(process.env.FIREBASE_CONFIG);
    }
  } catch (e) {
      console.error("Failed to parse FIREBASE_CONFIG, initializing with default.", e);
  }
  // initializeApp() with no arguments uses Application Default Credentials,
  // which is correct for App Hosting. Providing the parsed config adds robustness.
  initializeApp(config);
}

export const db = getFirestore();
