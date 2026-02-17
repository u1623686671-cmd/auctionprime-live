
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT. Please ensure it is a valid, single-line JSON string in your .env file.");
    // Throw a more descriptive error to be caught by the server action handler.
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT configuration. Check server logs for details.");
  }
}


if (!getApps().length) {
  initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : undefined,
  });
}

export const db = getFirestore();
