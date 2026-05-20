import { useEffect } from 'react';
import type { TabId } from '../types/index.ts';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  handler: () => void;
  description: string;
}

const TAB_SHORTCUTS: Array<{ key: string; tabId: TabId }> = [
  { key: '1', tabId: 'overview' },
  { key: '2', tabId: 'prs' },
  { key: '3', tabId: 'metrics' },
  { key: '4', tabId: 'team' },
  { key: '5', tabId: 'security' },
  { key: '6', tabId: 'config' },
  { key: '7', tabId: 'logs' },
];

export function useKeyboard(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      for (const sc of shortcuts) {
        const mod = sc.ctrl || sc.meta;
        const modPressed = sc.ctrl ? e.ctrlKey : sc.meta ? e.metaKey : true;
        if (e.key === sc.key && (!mod || modPressed)) {
          e.preventDefault();
          sc.handler();
          return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

export function getTabShortcuts(goToTab: (id: TabId) => void): KeyboardShortcut[] {
  return TAB_SHORTCUTS.map(({ key, tabId }) => ({
    key,
    meta: true,
    handler: () => goToTab(tabId),
    description: `Go to ${tabId} tab`,
  }));
}
