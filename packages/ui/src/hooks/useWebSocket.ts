import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketOptions {
  url: string;
  userId: string;
  token: string;
  onMessage?: (data: any) => void;
  onReconnect?: () => void;
  maxRetries?: number;
}

type WsStatus = 'Connected' | 'Connecting' | 'Disconnected' | 'Reconnecting' | 'Error';

export function useWebSocket({ url, userId, token, onMessage, onReconnect, maxRetries = 3 }: WebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>('Disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef({ count: 0, delay: 1000, timer: 0 });
  const closedRef = useRef(false);

  const connect = useCallback(() => {
    if (!url || closedRef.current) return;

    setStatus('Connecting');

    try {
      const socket = new WebSocket(url);

      socket.addEventListener('open', () => {
        retryRef.current.count = 0;
        retryRef.current.delay = 1000;
        setStatus('Connected');
        socket.send(JSON.stringify({ type: 'auth', userId, token }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'auth_success') {
            socket.send(JSON.stringify({ type: 'subscribe', channel: 'dashboard' }));
            return;
          }
          onMessage?.(data);
        } catch {
          // ignore parse errors
        }
      });

      socket.addEventListener('close', () => {
        if (closedRef.current) {
          setStatus('Disconnected');
          return;
        }
        retryRef.current.count++;
        if (retryRef.current.count < maxRetries) {
          setStatus('Reconnecting');
          retryRef.current.timer = window.setTimeout(() => {
            retryRef.current.delay = Math.min(retryRef.current.delay * 2, 15000);
            connect();
          }, retryRef.current.delay);
        } else {
          setStatus('Disconnected');
        }
      });

      socket.addEventListener('error', () => {
        retryRef.current.count++;
      });

      wsRef.current = socket;
    } catch {
      setStatus('Error');
      retryRef.current.count++;
      if (retryRef.current.count < maxRetries) {
        retryRef.current.timer = window.setTimeout(connect, retryRef.current.delay);
        retryRef.current.delay = Math.min(retryRef.current.delay * 2, 15000);
      }
    }
  }, [url, userId, token, onMessage, maxRetries]);

  useEffect(() => {
    if (!url) return;
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      clearTimeout(retryRef.current.timer);
      wsRef.current?.close(1000, 'unmount');
    };
  }, [url, connect]);

  return { status, isConnected: status === 'Connected' };
}
