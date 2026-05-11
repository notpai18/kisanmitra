import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
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
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const config = firebaseConfig as typeof firebaseConfig & { firestoreDatabaseId?: string };

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
}, config.firestoreDatabaseId || '(default)');

export const googleProvider = new GoogleAuthProvider();

/*
// Connect to emulators if on localhost
if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Connected to Firebase Emulators');
  } catch (err) {
    console.warn('Failed to connect to emulators:', err);
  }
}
*/

export const isMockConfig = firebaseConfig.apiKey === 'mock-api-key';

export { signInWithPopup, signOut, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, getDocs, serverTimestamp, increment, onAuthStateChanged };
export type { User } from 'firebase/auth';
export type { QueryConstraint, QueryDocumentSnapshot, DocumentData };
