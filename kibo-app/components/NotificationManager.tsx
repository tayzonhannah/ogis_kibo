'use client';

import { useEffect, useState } from 'react';

export function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!supported) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        new Notification('KIBO Aquarium', {
          body: 'Ambient notifications enabled! You will be notified when warmth or memos arrive.',
          icon: '/icons/icon-192.png',
        });
      }
    } catch (err) {
      console.warn('[kibo] Notification permission request error:', err);
    }
  };

  if (!supported) return null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <svg className="h-4 w-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <span className="text-xs text-white/80">Push Notifications</span>
      </div>

      {permission === 'granted' ? (
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
          Enabled
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void requestPermission()}
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white transition hover:bg-white/20"
        >
          {permission === 'denied' ? 'Blocked' : 'Enable'}
        </button>
      )}
    </div>
  );
}

export function triggerPushNotification(title: string, options?: NotificationOptions) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        ...options,
      });
    } catch (e) {
      console.warn('[kibo] Push notification trigger error:', e);
    }
  }
}
