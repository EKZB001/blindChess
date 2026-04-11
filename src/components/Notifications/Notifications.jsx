/**
 * Notifications Component
 * 
 * Toast notifications for game events:
 * check, life changes, captures, promotions, errors.
 */

import { useState, useEffect, useCallback } from 'react';
import './Notifications.css';

const NOTIFICATION_ICONS = {
  check: '⚠️',
  danger: '💔',
  life: '♥',
  vampirism: '🧛',
  capture: '⚔️',
  promotion: '👑',
  info: 'ℹ️',
  error: '❌',
  gameover: '🏁',
};

const NOTIFICATION_DURATION = 4000;

export default function Notifications({ notifications = [] }) {
  const [visibleNotifications, setVisibleNotifications] = useState([]);

  useEffect(() => {
    if (notifications.length === 0) return;

    // Add new notifications
    const newNotifs = notifications.map((n, i) => ({
      ...n,
      id: `${n.timestamp}-${i}`,
      exiting: false,
    }));

    setVisibleNotifications(prev => [...prev, ...newNotifs]);

    // Auto-dismiss after duration
    const timeoutIds = newNotifs.map(n =>
      setTimeout(() => {
        dismissNotification(n.id);
      }, NOTIFICATION_DURATION)
    );

    return () => timeoutIds.forEach(clearTimeout);
  }, [notifications]);

  const dismissNotification = useCallback((id) => {
    setVisibleNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, exiting: true } : n)
    );

    // Remove after exit animation
    setTimeout(() => {
      setVisibleNotifications(prev => prev.filter(n => n.id !== id));
    }, 250);
  }, []);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="notifications">
      {visibleNotifications.map(notif => (
        <div
          key={notif.id}
          className={`notification notification--${notif.type} ${notif.exiting ? 'notification--exiting' : ''}`}
          onClick={() => dismissNotification(notif.id)}
        >
          <span className="notification__icon">
            {NOTIFICATION_ICONS[notif.type] || 'ℹ️'}
          </span>
          <span className="notification__text">{notif.message}</span>
        </div>
      ))}
    </div>
  );
}
