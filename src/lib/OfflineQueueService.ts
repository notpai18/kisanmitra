import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface QueuedUpload {
  id: string;
  image: string; // base64
  mimeType: string;
  cropType: string;
  language: string;
  state: string;
  district: string;
  createdAt: number;
  retryCount: number;
}

const DB_NAME = 'kisanmitra-offline-queue';
const STORE_NAME = 'pending-uploads';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function addToQueue(upload: Omit<QueuedUpload, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const queuedItem: QueuedUpload = {
    ...upload,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    retryCount: 0,
  };

  store.add(queuedItem);
}

export async function getQueuedUploads(): Promise<QueuedUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.delete(id);
}

export async function incrementRetryCount(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const request = store.get(id);
  request.onsuccess = () => {
    const item = request.result as QueuedUpload;
    if (item) {
      item.retryCount += 1;
      store.put(item);
    }
  };
}

async function processUpload(upload: QueuedUpload): Promise<void> {
  const response = await fetch('/api/crop-doctor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: upload.image,
      mimeType: upload.mimeType,
      cropType: upload.cropType,
      language: upload.language,
      state: upload.state,
      district: upload.district,
    }),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const result = await response.json();

  // Store result in Firestore if needed
  if (result.disease_name) {
    // Save to user's diagnosis history
    const userId = localStorage.getItem('km_user_id');
    if (userId) {
      await addDoc(collection(db, `users/${userId}/diagnoses`), {
        ...result,
        createdAt: serverTimestamp(),
        syncedFrom: 'offline',
      });
    }
  }
}

export async function syncPendingUploads(): Promise<{ success: number; failed: number }> {
  const uploads = await getQueuedUploads();
  let success = 0;
  let failed = 0;

  for (const upload of uploads) {
    try {
      await processUpload(upload);
      await removeFromQueue(upload.id);
      success++;
    } catch (error) {
      console.error('Failed to sync upload:', upload.id, error);
      await incrementRetryCount(upload.id);
      failed++;
    }
  }

  return { success, failed };
}

// Listen for online event to trigger sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Network restored, syncing pending uploads...');
    syncPendingUploads().then(result => {
      console.log('[OfflineQueue] Sync complete:', result);
    });
  });
}

// Check pending uploads on load
export async function checkPendingUploads(): Promise<number> {
  const uploads = await getQueuedUploads();
  return uploads.length;
}