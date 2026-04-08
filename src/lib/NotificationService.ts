import { db, isMockConfig } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'bid' | 'order' | 'system';
  relatedId?: string;
}

export const NotificationService = {
  async sendNotification(userId: string, payload: NotificationPayload): Promise<void> {
    if (isMockConfig || !userId) {
      console.log(`[Mock Notification to ${userId}]`, payload);
      return;
    }

    try {
      await addDoc(collection(db, `notifications/${userId}/items`), {
        ...payload,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to send notification to', userId, error);
    }
  }
};
