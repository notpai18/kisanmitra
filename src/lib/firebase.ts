import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

/*
 * --- Firestore security rules (paste into Firebase Console → Firestore → Rules) ---
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId}/{document=**} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *     match /listings/{listingId} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null && request.auth.uid == resource.data.farmerId;
 *       allow create: if request.auth != null;
 *     }
 *     match /bids/{bidId} {
 *       allow read: if request.auth != null;
 *       allow create: if request.auth != null;
 *       allow update: if request.auth != null;
 *     }
 *   }
 * }
 */

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const config = firebaseConfig as typeof firebaseConfig & { firestoreDatabaseId?: string };
export const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const isMockConfig = firebaseConfig.apiKey === 'mock-api-key';

export { signInWithPopup, signOut, doc, setDoc, getDoc };
