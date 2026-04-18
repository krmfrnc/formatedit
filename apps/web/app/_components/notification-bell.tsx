'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface NotificationItem {
  id: string;
  eventType: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
}

interface ListResponse {
  items: NotificationItem[];
  nextCursor: string | null;
}

interface NotificationSocketLike {
  on(event: 'notification', listener: (payload: NotificationItem) => void): void;
  disconnect(): void;
}

export interface NotificationBellProps {
  initialToken?: string | null;
  initialItems?: NotificationItem[];
  initialUnread?: number;
  disableRemoteSync?: boolean;
  fetchImpl?: typeof fetch;
  createSocket?: (token: string) => NotificationSocketLike;
}

/**
 * Task 266: Bell icon + panel. Lists recent notifications, marks individual
 * rows as read, and subscribes to the `/notifications` Socket.IO namespace so
 * new notifications appear live.
 *
 * Relies on a JWT stored in localStorage under `formatedit.jwt` — same
 * convention as the checkout page.
 */
export function NotificationBell({
  initialToken = null,
  initialItems = [],
  initialUnread = 0,
  disableRemoteSync = false,
  fetchImpl = fetch,
  createSocket = (token: string) =>
    io(`${apiUrl}/notifications`, {
      auth: { token },
      transports: ['websocket'],
    }),
}: NotificationBellProps = {}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unread, setUnread] = useState<number>(initialUnread);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<NotificationSocketLike | null>(null);

  const authHeader = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  useEffect(() => {
    if (disableRemoteSync || typeof window === 'undefined' || initialToken) return;
    setToken(window.localStorage.getItem('formatedit.jwt'));
  }, [disableRemoteSync, initialToken]);

  const loadItems = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetchImpl(`${apiUrl}/notifications?limit=20`, {
        headers: authHeader,
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const payload = (await response.json()) as ListResponse;
      setItems(payload.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'failed to load');
    }
  }, [authHeader, fetchImpl, token]);

  const loadUnread = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetchImpl(`${apiUrl}/notifications/unread-count`, {
        headers: authHeader,
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { count: number };
      setUnread(payload.count);
    } catch {
      // noop
    }
  }, [authHeader, fetchImpl, token]);

  useEffect(() => {
    if (!token || disableRemoteSync) return;
    void loadItems();
    void loadUnread();
  }, [disableRemoteSync, loadItems, loadUnread, token]);

  useEffect(() => {
    if (!token || disableRemoteSync) return;
    const socket = createSocket(token);
    socket.on('notification', (payload: NotificationItem) => {
      setItems((current) => [payload, ...current].slice(0, 50));
      setUnread((count) => count + 1);
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [createSocket, disableRemoteSync, token]);

  const markRead = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        const response = await fetchImpl(`${apiUrl}/notifications/${id}/read`, {
          method: 'POST',
          headers: authHeader,
        });
        if (!response.ok) return;
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
          ),
        );
        setUnread((count) => Math.max(0, count - 1));
      } catch {
        // noop
      }
    },
    [authHeader, fetchImpl, token],
  );

  if (!token) {
    return null;
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        style={{
          position: 'relative',
          background: 'transparent',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        <span role="img" aria-hidden>
          🔔
        </span>
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#d93025',
              color: '#fff',
              borderRadius: 10,
              fontSize: 11,
              padding: '1px 6px',
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 44,
            width: 340,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #e0e0e0',
            boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
            borderRadius: 8,
            zIndex: 1000,
            padding: 8,
          }}
        >
          {error && (
            <div style={{ color: '#d93025', fontSize: 12, padding: 8 }}>{error}</div>
          )}
          {items.length === 0 && !error && (
            <div style={{ padding: 12, color: '#666', fontSize: 13 }}>No notifications.</div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 10,
                borderBottom: '1px solid #f0f0f0',
                background: item.readAt ? '#fafafa' : '#f5f9ff',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#333', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                {item.body}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#888' }}>
                  {new Date(item.createdAt).toLocaleString()}
                </span>
                {!item.readAt && (
                  <button
                    type="button"
                    onClick={() => void markRead(item.id)}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      background: '#1a73e8',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
