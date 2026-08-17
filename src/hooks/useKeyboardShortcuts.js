import { useEffect } from 'react';

export function useKeyboardShortcuts({ onSave, onUndo, onRedo, onNewNote, onFocusToggle, onToggleBold, onToggleItalic, onToggleUnderline, onExportPdf }) {
  useEffect(() => {
    function handler(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      const shift = e.shiftKey;

      switch (key) {
        case 's':
          e.preventDefault();
          onSave?.();
          break;
        case 'z':
          if (shift) { e.preventDefault(); onRedo?.(); }
          else { e.preventDefault(); onUndo?.(); }
          break;
        case 'y':
          e.preventDefault();
          onRedo?.();
          break;
        case 'b':
          e.preventDefault();
          onToggleBold?.();
          break;
        case 'i':
          e.preventDefault();
          onToggleItalic?.();
          break;
        case 'u':
          e.preventDefault();
          onToggleUnderline?.();
          break;
        case 'd':
          if (shift) { e.preventDefault(); onExportPdf?.(); }
          break;
        case 'n':
          e.preventDefault();
          onNewNote?.();
          break;
        case '\\':
          e.preventDefault();
          onFocusToggle?.();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave, onUndo, onRedo, onNewNote, onFocusToggle, onToggleBold, onToggleItalic, onToggleUnderline, onExportPdf]);
}
