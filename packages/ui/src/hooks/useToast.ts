import { useCallback, useSyncExternalStore, useRef } from 'react';
import type { Toast, ToastType } from '../types/index.ts';

let toasts: Toast[] = [];
let listeners: Array<() => void> = [];
let counter = 0;

function emitChange() {
  listeners.forEach((l) => l());
}

export function addToast(type: ToastType, title: string, message?: string, duration = 4000) {
  const id = `toast-${++counter}-${Date.now()}`;
  toasts = [...toasts, { id, type, title, message, duration }];
  emitChange();
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
  return id;
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emitChange();
}

function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getSnapshot() {
  return toasts;
}

export function useToast() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot);
  const toastRef = useRef({ addToast, removeToast });

  const success = useCallback((title: string, message?: string) => {
    addToast('success', title, message);
  }, []);

  const error = useCallback((title: string, message?: string) => {
    addToast('error', title, message);
  }, []);

  const info = useCallback((title: string, message?: string) => {
    addToast('info', title, message);
  }, []);

  const warning = useCallback((title: string, message?: string) => {
    addToast('warning', title, message);
  }, []);

  return {
    toasts: currentToasts,
    addToast: toastRef.current.addToast,
    removeToast: toastRef.current.removeToast,
    success,
    error,
    info,
    warning,
  };
}
