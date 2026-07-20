'use client';

import { useEffect } from 'react';

type KeyMap = Record<string, (e: KeyboardEvent) => void>;

export function useKeyboardShortcuts(keyMap: KeyMap, deps: React.DependencyList = []) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = [e.key, e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt']
        .filter(Boolean)
        .join('+');

      const cb = keyMap[key] || keyMap[e.key];
      if (cb) {
        e.preventDefault();
        cb(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, deps);
}
