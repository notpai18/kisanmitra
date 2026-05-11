import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp(config);
const db = getFirestore(app);

async function test() {
  try {
    console.log('Attempting unauthenticated write to "test" collection...');
    const docRef = await addDoc(collection(db, 'test'), {
      time: new Date().toISOString(),
      message: 'Server-side test'
    });
    console.log('Success! Doc ID:', docRef.id);
  } catch (e) {
    console.error('Failed:', e);
  }
}

test();
