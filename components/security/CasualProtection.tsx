'use client';

import { useEffect } from 'react';

export function CasualProtection() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const blocked =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) ||
        (e.ctrlKey && key === 'u');
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.closest('input, textarea, [contenteditable="true"]'))) return;
      e.preventDefault();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, []);

  return null;
}
