import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signOut,
  onAuthStateChanged,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  increment,
  runTransaction,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId
};

const app = initializeApp(config);
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
}, config.firestoreDatabaseId || '(default)');

// Enable multi-tab IndexedDB persistence for offline support
const enablePersistence = async () => {
  try {
    await enableIndexedDbPersistence(db);
    console.log('Firestore persistence enabled');
  } catch (err: any) {
    if (err.code === 'failed-precondition') {
      console.log('Persistence unavailable: multiple tabs open with different sessions');
    } else if (err.code === 'unimplemented') {
      console.log('Persistence not available in this browser environment');
    }
  }
};
enablePersistence();

// Auto-connect to emulators in dev mode
const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

if (isDev && useEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('🔥 Connected to Firebase Emulators (Auth & Firestore)');
}

export const isMockConfig = config.apiKey === 'mock-api-key';

export const googleProvider = new GoogleAuthProvider();

export {
  signOut,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  increment,
  runTransaction,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup
};
export type { User, ConfirmationResult } from 'firebase/auth';
export type { QueryConstraint, QueryDocumentSnapshot, DocumentData };
