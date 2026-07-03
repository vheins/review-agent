import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToast, removeToast } from '../hooks/useToast.ts';
import { cn } from '../lib/utils.js';
import type { ToastType } from '../types/index.ts';

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS: Record<ToastType, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

function ToastItem({ toast, onRemove }: { toast: { id: string; type: ToastType; title: string; message?: string }; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  const handleRemove = () => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  const Icon = ICONS[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-200',
        COLORS[toast.type],
        exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
      )}
      role="alert"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-xs opacity-80">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={handleRemove}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-auto">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
