
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  // By calling initializeApp() with no arguments, the Admin SDK will automatically
  // use the default service account credentials provided by the App Hosting environment.
  // This is the correct way to initialize in a deployed Google Cloud environment.
  initializeApp();
}

export const db = getFirestore();
