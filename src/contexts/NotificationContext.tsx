import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type { Notification, NotificationType } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    link?: string
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  createNotification: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen to notifications for current user
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      notifications
        .filter((n) => !n.read)
        .forEach((n) => {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [user, notifications]);

  const createNotification = useCallback(
    async (
      targetUserId: string,
      title: string,
      message: string,
      type: NotificationType,
      link?: string
    ) => {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: targetUserId,
          title,
          message,
          type,
          read: false,
          link: link || null,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error creating notification:', err);
      }
    },
    []
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        createNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};