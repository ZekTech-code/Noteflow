import { useEffect, useRef, useState, useCallback } from 'react';
import { useNotes } from '../store';
import { catLabel } from '../utils';
import { exportAsPdf, exportAsText } from '../lib/export';
import { sanitizeHtml } from '../lib/sanitize';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const FONTS = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, "Segoe UI", sans-serif' },
  { label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Segoe UI', value: '"Segoe UI", system-ui, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56, 64, 72];

const TEXT_COLORS = [
  '#000000', '#444444', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
];

const HIGHLIGHT_COLORS = [
  '#ffffff', '#fff2cc', '#ffe599', '#ffd966', '#fce5cd', '#f9cb9c', '#f6b26b', '#f4cccc', '#ea9999', '#e06666',
  '#d9ead3', '#b6d7a8', '#93c47d', '#d0e0e3', '#a2c4c9', '#76a5af', '#cfe2f3', '#9fc5e8', '#6fa8dc',
];

const BACKGROUND_COLORS = [
  '#ffffff', '#f5f5f5', '#e8e8e8', '#d6d6d6', '#c0c0c0', '#9e9e9e',
  '#fff8e1', '#fff3e0', '#ffe8cc', '#fbe9e7', '#fdece8', '#fde7e9',
  '#e3f2fd', '#e8eaf6', '#f3e5f5', '#e8f5e9', '#e0f2f1', '#eff6e8',
  '#ffe0b2', '#f8bbd0', '#e1bee7', '#c5cae9', '#bbdefb', '#c8e6c9', '#fff9c4', '#dcedc8',
  '#37474f', '#263238', '#3e2723', '#1b5e20', '#0d47a1', '#4a148c', '#b71c1c', '#e65100',
];

function luminance(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (isNaN(n)) return 0.5;
  return (
    0.2126 * (((n >> 16) & 255) / 255) +
    0.7152 * (((n >> 8) & 255) / 255) +
    0.0722 * ((n & 255) / 255)
  );
}

export default function Editor() {
  const { state, actions } = useNotes();
  const { notes, activeId, noNoteScreen } = state;
  const note = notes.find((n) => n.id === activeId) || null;

  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const activeIdRef = useRef(null);
  const savedRangeRef = useRef(null);
  const savedElRef = useRef('body');
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const lastSnapRef = useRef(null);
  const lastSnapTimeRef = useRef(0);
  const noteIdRef = useRef(null);
  const menuSavedRangeRef = useRef(null);
  const [align, setAlign] = useState(null);
  const [fontSel, setFontSel] = useState('');
  const [fontName, setFontName] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [suppressHover, setSuppressHover] = useState(null);
  const hoverTimerRef = useRef(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0, readTime: 0 });

  noteIdRef.current = note ? note.id : null;

  const autoResizeTitle = () => {
    const ta = titleRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  };

  // ---- custom undo/redo: native browser undo cannot track DOM-only edits ----
  const captureState = () => ({
    title: titleRef.current ? titleRef.current.innerHTML : '',
    body: contentRef.current ? contentRef.current.innerHTML : '',
  });
  const snapEquals = (a, b) => !!a && !!b && a.title === b.title && a.body === b.body;

  const pushUndo = () => {
    const snap = captureState();
    const stack = undoStackRef.current;
    if (!snapEquals(snap, stack[stack.length - 1])) {
      stack.push(snap);
      if (stack.length > 50) stack.shift();
    }
    redoStackRef.current = [];
    lastSnapRef.current = snap;
    lastSnapTimeRef.current = Date.now();
  };

  const refreshSnap = () => {
    lastSnapRef.current = captureState();
    lastSnapTimeRef.current = Date.now();
  };

  const restoreState = (snap) => {
    if (!snap) return;
    if (titleRef.current) titleRef.current.innerHTML = snap.title;
    if (contentRef.current) contentRef.current.innerHTML = snap.body;
    autoResizeTitle();
    if (noteIdRef.current) actions.onEdit(noteIdRef.current);
    lastSnapRef.current = snap;
    lastSnapTimeRef.current = Date.now();
  };

  const undo = () => {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    redoStackRef.current.push(captureState());
    restoreState(stack.pop());
  };

  const redo = () => {
    const stack = redoStackRef.current;
    if (!stack.length) return;
    undoStackRef.current.push(captureState());
    restoreState(stack.pop());
  };

  // Group consecutive typing into one undo step; toolbar edits call pushUndo.
  const recordInput = () => {
    if (Date.now() - lastSnapTimeRef.current > 500) {
      const snap = captureState();
      const stack = undoStackRef.current;
      if (!snapEquals(snap, lastSnapRef.current) && lastSnapRef.current) {
        stack.push(lastSnapRef.current);
        if (stack.length > 50) stack.shift();
        redoStackRef.current = [];
      }
      lastSnapRef.current = snap;
    }
    lastSnapTimeRef.current = Date.now();
  };

  // Load note into the editor when switching notes.
  useEffect(() => {
    if (!note) {
      activeIdRef.current = null;
      return;
    }
    if (activeIdRef.current !== note.id) {
      activeIdRef.current = note.id;
      savedRangeRef.current = null;
      savedElRef.current = 'body';
      if (titleRef.current) {
        titleRef.current.innerHTML = sanitizeHtml(note.title || '');
        titleRef.current.style.textAlign = note.titleAlign || 'center';
      }
      if (contentRef.current) contentRef.current.innerHTML = sanitizeHtml(note.content);
      autoResizeTitle();
      undoStackRef.current = [];
      redoStackRef.current = [];
      lastSnapRef.current = captureState();
      lastSnapTimeRef.current = 0;
      requestAnimationFrame(() => {
        if (note.title) {
          if (contentRef.current) contentRef.current.focus();
        } else if (titleRef.current) {
          titleRef.current.focus();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, note && note.id]);

  // Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z / Ctrl+Y (redo) for the editor.
  useEffect(() => {
    const onKey = (e) => {
      const t = document.activeElement && document.activeElement.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      } else if (k === 'b') {
        e.preventDefault();
        toggleInlineTag('strong');
      } else if (k === 'i') {
        e.preventDefault();
        toggleInlineTag('em');
      } else if (k === 'u') {
        e.preventDefault();
        toggleInlineTag('u');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Word count + reading time ----
  useEffect(() => {
    if (!note || !contentRef.current) return;
    const update = () => {
      const el = contentRef.current;
      if (!el) return;
      const text = (el.textContent || '').trim();
      const words = text ? text.split(/\s+/).length : 0;
      const chars = text.length;
      const readTime = Math.max(1, Math.ceil(words / 200));
      setWordCount({ words, chars, readTime });
    };
    update();
    const el = contentRef.current;
    if (el) el.addEventListener('input', update);
    return () => { if (el) el.removeEventListener('input', update); };
  }, [activeId]);

  // ---- Image paste into editor ----
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file || !file.type.startsWith('image/')) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const img = document.createElement('img');
            img.src = reader.result;
            img.alt = 'pasted image';
            img.style.cssText = 'max-width:100%;border-radius:6px;margin:8px 0;';
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
              const range = sel.getRangeAt(0);
              range.collapse(false);
              range.insertNode(img);
              range.setStartAfter(img);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
            actions.onEdit(note.id);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [activeId]);

  // ---- Drag-and-drop images ----
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onDrop = (e) => {
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const img = document.createElement('img');
            img.src = reader.result;
            img.alt = 'dropped image';
            img.style.cssText = 'max-width:100%;border-radius:6px;margin:8px 0;';
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
              const range = sel.getRangeAt(0);
              range.collapse(false);
              range.insertNode(img);
              range.setStartAfter(img);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
            actions.onEdit(note.id);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragover', (e) => e.preventDefault());
    return () => { el.removeEventListener('drop', onDrop); };
  }, [activeId]);

  // ---- Global keyboard shortcuts ----
  const handleSave = useCallback(() => { if (note) actions.saveNote(); }, [note]);
  const handleUndo = useCallback(() => undo(), []);
  const handleRedo = useCallback(() => redo(), []);
  const handleNewNote = useCallback(() => actions.openModal('new'), []);
  const handleFocusToggle = useCallback(() => actions.toggleFocus(), []);
  const handleBold = useCallback(() => toggleInlineTag('strong'), []);
  const handleItalic = useCallback(() => toggleInlineTag('em'), []);
  const handleUnderline = useCallback(() => toggleInlineTag('u'), []);
  const handleExportPdf = useCallback(() => { if (note) exportAsPdf(note.title, titleRef.current?.innerHTML || '', contentRef.current?.innerHTML || '', note.bgColor, note.titleAlign || 'center'); }, [note]);

  useKeyboardShortcuts({
    onSave: handleSave, onUndo: handleUndo, onRedo: handleRedo,
    onNewNote: handleNewNote, onFocusToggle: handleFocusToggle,
    onToggleBold: handleBold, onToggleItalic: handleItalic, onToggleUnderline: handleUnderline,
    onExportPdf: handleExportPdf,
  });

  // ---- Table: insert, context menu, cell navigation ----
  const [tableCtx, setTableCtx] = useState(null);

  const insertTable = useCallback(() => {
    restoreSelection();
    pushUndo();
    const html = `<table class="note-table"><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table><p></p>`;
    document.execCommand('insertHTML', false, html);
    actions.onEdit(note.id);
  }, [note]);

  const handleTableContext = useCallback((e) => {
    const td = e.target.closest('td, th');
    if (!td) return;
    e.preventDefault();
    const table = td.closest('table');
    if (!table) return;
    const tr = td.closest('tr');
    const colIdx = Array.from(tr.children).indexOf(td);
    const rowIdx = Array.from(table.querySelectorAll('tr')).indexOf(tr);
    const isHead = td.tagName === 'TH';
    setTableCtx({ x: e.clientX, y: e.clientY, table, td, tr, colIdx, rowIdx, isHead });
  }, []);

  const tableAction = useCallback((action) => {
    if (!tableCtx) return;
    const { table, tr, colIdx, rowIdx, isHead } = tableCtx;
    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(table.querySelectorAll('tr'));
    pushUndo();
    switch (action) {
      case 'add-row-above': {
        const newRow = document.createElement('tr');
        const cellCount = tr.children.length;
        for (let i = 0; i < cellCount; i++) { const td = document.createElement('td'); td.innerHTML = '<br>'; newRow.appendChild(td); }
        tr.parentNode.insertBefore(newRow, tr);
        break;
      }
      case 'add-row-below': {
        const newRow = document.createElement('tr');
        const cellCount = tr.children.length;
        for (let i = 0; i < cellCount; i++) { const td = document.createElement('td'); td.innerHTML = '<br>'; newRow.appendChild(td); }
        tr.after(newRow);
        break;
      }
      case 'add-col-left': {
        const targetRows = Array.from(table.querySelectorAll('tr'));
        targetRows.forEach((r) => {
          const newTd = document.createElement(r.children[colIdx]?.tagName === 'TH' ? 'th' : 'td');
          newTd.innerHTML = '<br>';
          r.children[colIdx].before(newTd);
        });
        break;
      }
      case 'add-col-right': {
        const targetRows = Array.from(table.querySelectorAll('tr'));
        targetRows.forEach((r) => {
          const ref = r.children[colIdx];
          const newTd = document.createElement(ref?.tagName === 'TH' ? 'th' : 'td');
          newTd.innerHTML = '<br>';
          ref.after(newTd);
        });
        break;
      }
      case 'delete-row': {
        if (rows.length <= 1) { table.remove(); break; }
        tr.remove();
        break;
      }
      case 'delete-col': {
        const allRows = Array.from(table.querySelectorAll('tr'));
        allRows.forEach((r) => {
          if (r.children.length <= 1) return;
          r.children[colIdx]?.remove();
        });
        if (table.querySelectorAll('tr').length === 0) table.remove();
        break;
      }
      case 'delete-table':
        table.remove();
        break;
    }
    setTableCtx(null);
    actions.onEdit(note.id);
  }, [tableCtx, note]);

  useEffect(() => {
    if (!tableCtx) return;
    const close = (e) => { if (!e.target.closest('.table-ctx-menu')) setTableCtx(null); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [tableCtx]);

  // controls (which steal focus) can restore it before applying formatting.
  useEffect(() => {
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, []);

  // ---- Live transcription: insert text chunks into the note body ----
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    const queue = state.transcriptPending;
    if (!queue || queue.length === 0 || !contentRef.current || !note) return;

    const text = queue[0];
    if (text === lastTranscriptRef.current) {
      actions.shiftTranscript();
      return;
    }
    lastTranscriptRef.current = text;

    const el = contentRef.current;
    el.focus();

    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    const space = document.createTextNode(' ');
    range.insertNode(space);
    range.setStartAfter(space);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    actions.onEdit(note.id);
    actions.shiftTranscript();
  }, [state.transcriptPending, note && note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose DOM getters to the store so autosave can snapshot the editor.
  useEffect(() => {
    if (note) {
      actions.registerEditor({
        id: note.id,
        getTitle: () => (titleRef.current ? titleRef.current.innerHTML : ''),
        getContent: () => (contentRef.current ? contentRef.current.innerHTML : ''),
      });
    } else {
      actions.registerEditor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (!note) {
    const saved = noNoteScreen === 'saved';
  return (
    <main className={`editor-wrap ${state.focusMode ? 'focus-mode' : ''}`}>
        <div className="no-note">
          <i
            className={saved ? 'fa-solid fa-circle-check' : 'fa-regular fa-note-sticky'}
            style={saved ? { color: 'var(--success)' } : undefined}
          ></i>
          <h3>{saved ? 'Note Saved!' : 'Create or select a note'}</h3>
          {saved && <p>Your note has been saved successfully.</p>}
          <button className="btn btn-primary" onClick={() => actions.openModal('new')}>
            <i className="fa-solid fa-plus"></i> Create Note
          </button>
        </div>
      </main>
    );
  }

  // ---- contenteditable formatting helpers (ported from vanilla) ----

  const getCaretBlock = () => {
    const el = contentRef.current;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node.parentNode !== el) node = node.parentNode;
    return node && node !== el ? node : null;
  };

  const toggleInlineTag = (tag) => {
    const sel = restoreSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    pushUndo();
    const cmdMap = { strong: 'bold', em: 'italic', u: 'underline', s: 'strikethrough' };
    document.execCommand(cmdMap[tag], false, null);
    // Re-capture the selection after the DOM mutation so the next call works.
    captureSelection();
    actions.onEdit(note.id);
    refreshSnap();
  };

  const toggleList = (tag) => {
    const el = contentRef.current;
    restoreSelection();
    pushUndo();
    document.execCommand(tag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList', false, null);
    captureSelection();
    actions.onEdit(note.id);
    refreshSnap();
  };

  const setAlignment = (alignVal) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const activeEl = document.activeElement;
    if (activeEl === titleRef.current || (titleRef.current && titleRef.current.contains(activeEl))) {
      titleRef.current.style.textAlign = alignVal;
      actions.setTitleAlign(note.id, alignVal);
      setAlign(alignVal);
      setSuppressHover('align');
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => setSuppressHover(null), 1200);
      actions.onEdit(note.id);
      return;
    }

    const el = contentRef.current;
    pushUndo();

    let block = getCaretBlock();
    if (!block || block === el) {
      const p = document.createElement('p');
      const r = sel.getRangeAt(0);
      try {
        r.surroundContents(p);
      } catch {
        p.appendChild(r.extractContents());
        r.insertNode(p);
      }
      block = p;
    }
    block.style.textAlign = alignVal;
    setAlign(alignVal);
    setSuppressHover('align');
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setSuppressHover(null), 1200);

    const onEnter = (e) => {
      if (e.key === 'Enter') {
        el.removeEventListener('keydown', onEnter);
        setTimeout(() => {
          const nb = getCaretBlock();
          if (nb) nb.style.textAlign = 'left';
          setAlign(null);
        }, 0);
      }
    };
    el.addEventListener('keydown', onEnter);
    captureSelection();
    actions.onEdit(note.id);
    refreshSnap();
  };

  const getSavedEl = () => {
    const el = savedElRef.current === 'title' ? titleRef.current : contentRef.current;
    return el || contentRef.current;
  };

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const node = sel.anchorNode;
    if (!node) return;
    const titleEl = titleRef.current;
    const bodyEl = contentRef.current;
    if (titleEl && titleEl.contains(node)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      savedElRef.current = 'title';
    } else if (bodyEl && bodyEl.contains(node)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      savedElRef.current = 'body';
    }
  }

  // Save the current contentEditable selection so dropdown item clicks can restore it.
  const saveMenuSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      const node = sel.anchorNode;
      if (node && contentRef.current && contentRef.current.contains(node)) {
        menuSavedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    }
  };

  // Restore the selection saved by saveMenuSelection. Used by dropdown item click handlers.
  const restoreMenuSelection = () => {
    if (!menuSavedRangeRef.current) return false;
    const el = contentRef.current;
    if (!el) return false;
    el.focus();
    const sel = window.getSelection();
    try {
      sel.removeAllRanges();
      sel.addRange(menuSavedRangeRef.current);
      return true;
    } catch {
      return false;
    }
  };

  const restoreSelection = () => {
    const el = getSavedEl();
    if (!el) return window.getSelection();
    el.focus();
    const sel = window.getSelection();
    if (savedRangeRef.current && (!sel.rangeCount || sel.isCollapsed)) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      } catch {
        // Range detached – ignore, rely on whatever selection the browser has.
      }
    }
    return sel;
  };

  // Copy only the selected text (no backgrounds, colors or other formatting).
  const copyPlain = (e) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', sel.toString());
  };

  // Wrap the selected text (or the current block) in a styled span. Works
  // text-node by text-node so element structure is never broken.
  const wrapSelection = (styleProp, value) => {
    // First try whatever the browser currently has selected.
    let sel = window.getSelection();
    // If nothing selected, try the range saved by the dropdown trigger mousedown.
    if ((!sel || !sel.rangeCount || sel.isCollapsed) && menuSavedRangeRef.current) {
      const el = contentRef.current;
      if (el) {
        el.focus();
        try {
          sel.removeAllRanges();
          sel.addRange(menuSavedRangeRef.current);
        } catch { /* stale */ }
      }
    }
    // Last resort: try the generic saved range.
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      sel = restoreSelection();
    }
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    pushUndo();

    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;

    // Collect the text nodes touched by the selection.
    const nodes = [];
    if (common.nodeType === 3) {
      nodes.push(common);
    } else {
      const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        if (range.intersectsNode(n)) nodes.push(n);
      }
    }

    let firstSpan = null;
    for (const node of nodes) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.data.length;
      if (end <= start) continue;
      let selected = node;
      if (start > 0) selected = selected.splitText(start);
      const selLen = end - start;
      if (selLen < selected.data.length) selected.splitText(selLen);

      // If the selected text already sits inside a SPAN and that whole span
      // is inside the selection, update the span in place instead of nesting.
      const p = selected.parentNode;
      if (
        p &&
        p !== common &&
        p.nodeType === 1 &&
        p.tagName === 'SPAN' &&
        range.containsNode(p, false)
      ) {
        p.style[styleProp] = value;
        if (!firstSpan) firstSpan = p;
        continue;
      }

      const span = document.createElement('span');
      span.style[styleProp] = value;
      if (selected.parentNode) selected.parentNode.insertBefore(span, selected);
      span.appendChild(selected);
      if (!firstSpan) firstSpan = span;
    }

    // Re-select the formatted text so the next formatting call works.
    sel.removeAllRanges();
    const nr = document.createRange();
    if (firstSpan) {
      nr.selectNodeContents(firstSpan);
    } else if (range.startContainer) {
      nr.setStart(range.startContainer, range.startOffset);
      nr.setEnd(range.endContainer, range.endOffset);
    }
    sel.addRange(nr);
    savedRangeRef.current = nr.cloneRange();
    menuSavedRangeRef.current = nr.cloneRange();
    savedElRef.current = 'body';

    actions.onEdit(note.id);
    refreshSnap();
  };

  const applyCase = (transform) => wrapSelection('text-transform', transform);

  const execFormat = (cmd, val) => {
    const el = contentRef.current;
    if (!el) return;
    restoreMenuSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    pushUndo();
    document.execCommand(cmd, false, val || null);
    captureSelection();
    actions.onEdit(note.id);
    refreshSnap();
  };

  const setFontSize = (size) => execFormat('fontSize', '7');

  const setColor = (color) => execFormat('foreColor', color);

  const setHighlight = (color) => execFormat('hiliteColor', color);

  const readableTextColor = (hex) => {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const n = parseInt(full, 16);
    if (isNaN(n)) return undefined;
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111111' : '#ffffff';
  };

  const caseBtn = (transform) => applyCase(transform);

  const applyFont = (font) => {
    setFontName(font.label);
    execFormat('fontName', font.value);
    setOpenMenu(null);
  };

  const applySize = (px) => {
    setFontSel(String(px));
    const el = contentRef.current;
    if (!el) { setOpenMenu(null); return; }
    restoreMenuSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) { setOpenMenu(null); return; }
    pushUndo();
    document.execCommand('fontSize', false, '7');
    el.querySelectorAll('font[size]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode.replaceChild(span, f);
    });
    captureSelection();
    actions.onEdit(note.id);
    refreshSnap();
    setOpenMenu(null);
  };

  const applyTextColor = (hex) => {
    execFormat('foreColor', hex);
    setOpenMenu(null);
  };

  const applyHighlight = (hex) => {
    execFormat('hiliteColor', hex);
    setOpenMenu(null);
  };

  const currentFont = FONTS.find((f) => f.label === fontName) || null;

  const openFontMenu = openMenu === 'font';
  const openSizeMenu = openMenu === 'size';
  const openTextColorMenu = openMenu === 'textcolor';
  const openHighlightMenu = openMenu === 'highlight';
  const openBgColorMenu = openMenu === 'bgcolor';
  const openBlockMenu = openMenu === 'block';

  const applyBlockFormat = (tag) => {
    const el = contentRef.current;
    if (!el) return;
    restoreSelection();
    pushUndo();
    if (tag === 'hr') {
      document.execCommand('insertHorizontalRule', false, null);
    } else if (tag === 'p') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${tag}>`);
    }
    captureSelection();
    actions.onEdit(note.id);
    refreshSnap();
    setOpenMenu(null);
  };

  return (
    <>
    <main className="editor-wrap">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          className="editor-toolbar"
          onMouseDown={(e) => {
            if (e.target.closest('.tool-btn, .tool-dropdown-btn, .tool-color, .dropdown-item, .color-swatch, .bg-default-option')) {
              e.preventDefault();
            }
            if (e.target.closest('.tool-dropdown-btn, .tool-color')) {
              saveMenuSelection();
            }
          }}
        >
          <button className={`tool-btn${note.pinned ? ' active' : ''}`} data-tooltip="Pin" aria-label="Pin Note" onClick={() => actions.togglePin()}>
            <i className="fa-solid fa-thumbtack"></i>
          </button>
          <span className="toolbar-sep"></span>
          <button className="tool-btn" data-tooltip="Undo" aria-label="Undo" onClick={undo} disabled={!undoStackRef.current.length}>
            <i className="fa-solid fa-rotate-left"></i>
          </button>
          <button className="tool-btn" data-tooltip="Redo" aria-label="Redo" onClick={redo} disabled={!redoStackRef.current.length}>
            <i className="fa-solid fa-rotate-right"></i>
          </button>
          <span className="toolbar-sep"></span>
          <div className="tool-dropdown">
            <button className="tool-dropdown-btn" data-tooltip="Block format" aria-label="Block format" onClick={() => setOpenMenu(openBlockMenu ? null : 'block')}>
              <i className="fa-solid fa-heading"></i>
              <i className="fa-solid fa-caret-down dropdown-caret"></i>
            </button>
            {openBlockMenu && (
              <>
                <div className="dropdown-overlay" onMouseDown={(e) => { if (!e.target.closest('.dropdown-menu')) setOpenMenu(null); }} />
                <div className="dropdown-menu">
                  {[
                    { tag: 'p', label: 'Paragraph', icon: 'fa-paragraph' },
                    { tag: 'h1', label: 'Heading 1', icon: 'fa-heading', style: { fontSize: '1.4rem', fontWeight: 700 } },
                    { tag: 'h2', label: 'Heading 2', icon: 'fa-heading', style: { fontSize: '1.2rem', fontWeight: 600 } },
                    { tag: 'h3', label: 'Heading 3', icon: 'fa-heading', style: { fontSize: '1rem', fontWeight: 600 } },
                    { tag: 'blockquote', label: 'Blockquote', icon: 'fa-quote-left' },
                    { tag: 'pre', label: 'Code Block', icon: 'fa-code' },
                    { tag: 'hr', label: 'Horizontal Rule', icon: 'fa-minus' },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      className="dropdown-item"
                      style={item.style}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyBlockFormat(item.tag)}
                    >
                      <i className={`fa-solid ${item.icon}`}></i> {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <span className="toolbar-sep"></span>
          <button className="tool-btn" data-tooltip="Bold" aria-label="Bold" onClick={() => toggleInlineTag('strong')}>
            <i className="fa-solid fa-bold"></i>
          </button>
          <button className="tool-btn" data-tooltip="Italic" aria-label="Italic" onClick={() => toggleInlineTag('em')}>
            <i className="fa-solid fa-italic"></i>
          </button>
          <button className="tool-btn" data-tooltip="Underline" aria-label="Underline" onClick={() => toggleInlineTag('u')}>
            <i className="fa-solid fa-underline"></i>
          </button>
          <button className="tool-btn" data-tooltip="Strikethrough" aria-label="Strikethrough" onClick={() => toggleInlineTag('s')}>
            <i className="fa-solid fa-strikethrough"></i>
          </button>
          <span className="toolbar-sep"></span>
          <button className="tool-btn" data-tooltip="Bullets" aria-label="Bullet List" onClick={() => toggleList('ul')}>
            <i className="fa-solid fa-list-ul"></i>
          </button>
          <button className="tool-btn" data-tooltip="Numbers" aria-label="Numbered List" onClick={() => toggleList('ol')}>
            <i className="fa-solid fa-list-ol"></i>
          </button>
          <button className="tool-btn" data-tooltip="Checklist" aria-label="Checklist" onClick={() => { restoreSelection(); pushUndo(); document.execCommand('insertHTML', false, '<div class="checklist-item"><span class="checklist-box" contenteditable="false">☐</span> </div>'); actions.onEdit(note.id); }}>
            <i className="fa-regular fa-square-check"></i>
          </button>
          <span className="toolbar-sep"></span>
          <button className={`tool-btn${align === 'left' ? ' active' : ''}${suppressHover === 'align' ? ' suppress-hover' : ''}`} data-tooltip="Left" aria-label="Left" onClick={() => setAlignment('left')}>
            <i className="fa-solid fa-align-left"></i>
          </button>
          <button className={`tool-btn${align === 'center' ? ' active' : ''}${suppressHover === 'align' ? ' suppress-hover' : ''}`} data-tooltip="Center" aria-label="Center" onClick={() => setAlignment('center')}>
            <i className="fa-solid fa-align-center"></i>
          </button>
          <button className={`tool-btn${align === 'right' ? ' active' : ''}${suppressHover === 'align' ? ' suppress-hover' : ''}`} data-tooltip="Right" aria-label="Right" onClick={() => setAlignment('right')}>
            <i className="fa-solid fa-align-right"></i>
          </button>
          <button className={`tool-btn${align === 'justify' ? ' active' : ''}${suppressHover === 'align' ? ' suppress-hover' : ''}`} data-tooltip="Justify" aria-label="Justify" onClick={() => setAlignment('justify')}>
            <i className="fa-solid fa-align-justify"></i>
          </button>
          <span className="toolbar-sep"></span>
          <button className="tool-btn tool-btn-case" data-tooltip="UPPERCASE" aria-label="Uppercase" onClick={() => caseBtn('uppercase')}>
            <span>AA</span>
          </button>
          <button className="tool-btn tool-btn-case" data-tooltip="lowercase" aria-label="Lowercase" onClick={() => caseBtn('lowercase')}>
            <span>aa</span>
          </button>
          <button className="tool-btn tool-btn-case" data-tooltip="Capitalize" aria-label="Capitalize" onClick={() => caseBtn('capitalize')}>
            <span>Aa</span>
          </button>
          <span className="toolbar-sep"></span>
          <div className="tool-dropdown">
            <button className="tool-dropdown-btn" data-tooltip="Font" aria-label="Font" onClick={() => setOpenMenu(openFontMenu ? null : 'font')}>
              <span className="dropdown-label" style={{ fontFamily: currentFont ? currentFont.value : undefined }}>
                {fontName || 'Font'}
              </span>
              <i className="fa-solid fa-caret-down dropdown-caret"></i>
            </button>
            {openFontMenu && (
              <>
                <div className="dropdown-overlay" onMouseDown={(e) => { if (!e.target.closest('.dropdown-menu')) setOpenMenu(null); }} />
                <div className="dropdown-menu">
                  {FONTS.map((f) => (
                    <button key={f.label} className="dropdown-item" style={{ fontFamily: f.value }} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFont(f)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="tool-dropdown">
            <button className="tool-dropdown-btn tool-dropdown-btn-sm" data-tooltip="Size" aria-label="Font size" onClick={() => setOpenMenu(openSizeMenu ? null : 'size')}>
              <span>{fontSel || 'Size'}</span>
              <i className="fa-solid fa-caret-down dropdown-caret"></i>
            </button>
            {openSizeMenu && (
              <>
                <div className="dropdown-overlay" onMouseDown={(e) => { if (!e.target.closest('.dropdown-menu')) setOpenMenu(null); }} />
                <div className="dropdown-menu size-menu">
                  {FONT_SIZES.map((s) => (
                    <button key={s} className={`dropdown-item size-item${fontSel === String(s) ? ' selected' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => applySize(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <span className="toolbar-sep"></span>
          <div className="tool-dropdown">
            <button className="tool-color tool-dropdown-color-btn" data-tooltip="Text color" aria-label="Text color" onClick={() => setOpenMenu(openTextColorMenu ? null : 'textcolor')}>
              <i className="fa-solid fa-a"></i>
            </button>
            {openTextColorMenu && (
              <>
                <div className="dropdown-overlay" onMouseDown={(e) => { if (!e.target.closest('.dropdown-menu')) setOpenMenu(null); }} />
                <div className="dropdown-menu color-menu">
                  <div className="dropdown-section-label">Text color</div>
                  <div className="bg-option-row">
                    <button className="bg-default-option" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => applyTextColor('inherit')}>
                      <i className="fa-solid fa-circle-dot"></i> Automatic
                    </button>
                  </div>
                  <div className="color-grid">
                    {TEXT_COLORS.map((c) => (
                      <button key={c} className="color-swatch" style={{ background: c }} data-tooltip={c} aria-label={c} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => applyTextColor(c)} />
                    ))}
                    <label className="color-swatch more" data-tooltip="More colors" aria-label="More colors">
                      <i className="fa-solid fa-plus"></i>
                      <input type="color" className="color-custom-input" onChange={(e) => applyTextColor(e.target.value)} />
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="tool-dropdown">
            <button className="tool-color tool-dropdown-color-btn" data-tooltip="Highlight" aria-label="Highlight color" onClick={() => setOpenMenu(openHighlightMenu ? null : 'highlight')}>
              <i className="fa-solid fa-highlighter"></i>
            </button>
            {openHighlightMenu && (
              <>
                <div className="dropdown-overlay" onMouseDown={(e) => { if (!e.target.closest('.dropdown-menu')) setOpenMenu(null); }} />
                <div className="dropdown-menu color-menu">
                  <div className="dropdown-section-label">Highlight color</div>
                  <div className="bg-option-row">
                    <button className="bg-default-option" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => applyHighlight('transparent')}>
                      <i className="fa-solid fa-ban"></i> No highlight
                    </button>
                  </div>
                  <div className="color-grid">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button key={c} className="color-swatch" style={{ background: c }} data-tooltip={c} aria-label={c} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => applyHighlight(c)} />
                    ))}
                    <label className="color-swatch more" data-tooltip="More colors" aria-label="More colors">
                      <i className="fa-solid fa-plus"></i>
                      <input type="color" className="color-custom-input" onChange={(e) => applyHighlight(e.target.value)} />
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="tool-dropdown">
            <button className="tool-color tool-dropdown-color-btn" data-tooltip="Note color" aria-label="Note background color" style={{ color: note.bgColor ? 'var(--accent)' : undefined }} onClick={() => setOpenMenu(openBgColorMenu ? null : 'bgcolor')}>
              <i className="fa-solid fa-fill-drip"></i>
            </button>
            {openBgColorMenu && (
              <>
                <div className="dropdown-overlay" onMouseDown={(e) => { if (!e.target.closest('.dropdown-menu')) setOpenMenu(null); }} />
                <div className="dropdown-menu color-menu">
                  <div className="dropdown-section-label">Note background</div>
                  <div className="bg-option-row">
                    <button className="bg-default-option" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => { actions.setBgColor(note.id, null); setOpenMenu(null); }}>
                      <i className="fa-solid fa-ban"></i> Default
                    </button>
                  </div>
                  <div className="color-grid">
                    {BACKGROUND_COLORS.map((c) => (
                      <button key={c} className={`color-swatch${note.bgColor === c ? ' selected' : ''}`} style={{ background: c }} data-tooltip={c} aria-label={c} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => { actions.setBgColor(note.id, c); setOpenMenu(null); }} />
                    ))}
                    <label className="color-swatch more" data-tooltip="More" aria-label="More colors">
                      <i className="fa-solid fa-plus"></i>
                      <input type="color" className="color-custom-input" onChange={(e) => { actions.setBgColor(note.id, e.target.value); setOpenMenu(null); }} />
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
          <span className="toolbar-sep"></span>
          <button className="tool-btn" data-tooltip="Table" aria-label="Insert Table" onClick={() => insertTable()}>
            <i className="fa-solid fa-table"></i>
          </button>
          <button className="tool-btn" data-tooltip="Code" aria-label="Code Block" onClick={() => { restoreSelection(); pushUndo(); document.execCommand('insertHTML', false, '<pre style="background:#f4f4f4;padding:12px;border-radius:6px;font-family:monospace;font-size:0.9em;overflow-x:auto;">Code here...</pre><p></p>'); actions.onEdit(note.id); }}>
            <i className="fa-solid fa-code"></i>
          </button>
          <button className="tool-btn" data-tooltip="Divider" aria-label="Divider" onClick={() => { restoreSelection(); pushUndo(); document.execCommand('insertHTML', false, '<hr><p></p>'); actions.onEdit(note.id); }}>
            <i className="fa-solid fa-minus"></i>
          </button>
          <span className="toolbar-sep"></span>
          <button className="tool-btn" data-tooltip="Category" aria-label="Category" onClick={() => actions.openModal('category')}>
            <i className="fa-solid fa-tag"></i>
          </button>
          <span style={{ flex: 1 }}></span>
          <button className="tool-btn" data-tooltip={state.focusMode ? 'Exit focus' : 'Focus mode'} aria-label="Focus Mode" onClick={() => actions.toggleFocus()} style={state.focusMode ? { color: 'var(--accent)' } : undefined}>
            <i className={state.focusMode ? 'fa-solid fa-expand' : 'fa-solid fa-minimize'}></i>
          </button>
          <button className="tool-btn" data-tooltip="Version history" aria-label="Version history" onClick={() => actions.openModal('versions')}>
            <i className="fa-solid fa-clock-rotate-left"></i>
          </button>
          <div className="tool-dropdown">
            <button className="tool-btn" data-tooltip="Export" aria-label="Export" onClick={() => setExportOpen(!exportOpen)}>
              <i className="fa-solid fa-file-export"></i>
            </button>
            {exportOpen && (
              <>
                <div className="dropdown-overlay" onMouseDown={(e) => { e.preventDefault(); setExportOpen(false); setTimeout(() => contentRef.current?.focus(), 0); }} />
                <div className="dropdown-menu">
                  <button className="dropdown-item" onClick={() => { exportAsPdf(note.title, titleRef.current?.innerHTML || '', contentRef.current?.innerHTML || '', note.bgColor, note.titleAlign || 'center'); actions.showToast('PDF exported'); setExportOpen(false); setTimeout(() => contentRef.current?.focus(), 50); }}>
                    <i className="fa-solid fa-file-pdf"></i> Export as PDF
                  </button>
                  <button className="dropdown-item" onClick={() => { const allHtml = (titleRef.current?.innerHTML || '') + (contentRef.current?.innerHTML || ''); exportAsText(note.title, allHtml); actions.showToast('Text exported'); setExportOpen(false); setTimeout(() => contentRef.current?.focus(), 50); }}>
                    <i className="fa-solid fa-file-lines"></i> Export as Text
                  </button>
                  <button className="dropdown-item" onClick={() => { exportAsPdf(note.title, titleRef.current?.innerHTML || '', contentRef.current?.innerHTML || '', note.bgColor, note.titleAlign || 'center'); setExportOpen(false); setTimeout(() => contentRef.current?.focus(), 0); }}>
                    <i className="fa-solid fa-print"></i> Print
                  </button>
                  <button className="dropdown-item" onClick={() => { actions.openModal('share'); setExportOpen(false); }}>
                    <i className="fa-solid fa-share-nodes"></i> Share
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="tool-btn" data-tooltip="Duplicate" aria-label="Duplicate" onClick={() => actions.duplicate()}>
            <i className="fa-regular fa-copy"></i>
          </button>
          <button className="tool-btn" data-tooltip={note.archived ? 'Unarchive' : 'Archive'} aria-label="Archive" onClick={() => actions.openModal('archive')}>
            <i className={note.archived ? 'fa-solid fa-box-open' : 'fa-solid fa-box-archive'}></i>
          </button>
          <button className="tool-btn btn-danger" data-tooltip="Delete" aria-label="Delete" onClick={() => actions.openModal('delete')}>
            <i className="fa-solid fa-trash"></i>
          </button>
          <button className="btn btn-primary btn-save" onClick={() => actions.saveNote()}>
            <i className="fa-solid fa-floppy-disk"></i> Save
          </button>
        </div>

        <div
          className="editor-paper"
          style={note.bgColor ? { background: note.bgColor, color: readableTextColor(note.bgColor) } : undefined}
        >
          <div className="editor-title-area">
            <div
              ref={titleRef}
              className="editor-title"
              contentEditable
              data-placeholder="Untitled"
              spellCheck={false}
              onInput={() => {
                autoResizeTitle();
                recordInput();
                actions.onEdit(note.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (contentRef.current) contentRef.current.focus();
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = (e.clipboardData.getData('text/plain') || '').replace(/[\r\n]+/g, ' ');
                document.execCommand('insertText', false, text);
              }}
              onBlur={() => actions.onEdit(note.id)}
              onCopy={copyPlain}
            ></div>
          </div>

          <div className="editor-meta-bar">
            <div className="meta-item">
              <i className="fa-regular fa-calendar"></i>
              <span>{new Date(note.updatedAt).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="meta-item">
              <i className="fa-solid fa-folder"></i>
              <span>{catLabel(note.category)}</span>
            </div>
            <div className="tag-input-wrap">
              {note.tags.map((t) => (
                <span className="tag-pill" key={t}>
                  #{t} <button data-tooltip="Remove" aria-label="Remove" onClick={() => actions.removeTag(note.id, t)}>
                    ×
                  </button>
                </span>
              ))}
              <button className="add-tag-btn" onClick={() => actions.openModal('tag')}>
                <i className="fa-solid fa-plus"></i> Tag
              </button>
            </div>
          </div>

          <div className="editor-body">
            <div
              ref={contentRef}
              className="content-area"
              contentEditable
              data-placeholder="Start writing your note…"
              onCopy={copyPlain}
              onContextMenu={handleTableContext}
              onClick={(e) => {
                const box = e.target.closest('.checklist-box');
                if (box) {
                  e.preventDefault();
                  const item = box.closest('.checklist-item');
                  if (item) {
                    item.classList.toggle('checked');
                    box.textContent = item.classList.contains('checked') ? '☑' : '☐';
                    actions.onEdit(note.id);
                  }
                }
              }}
              onInput={() => {
                recordInput();
                actions.onEdit(note.id);
              }}
            ></div>
          </div>
          <div className="editor-footer">
            <span>{wordCount.words} words</span>
            <span className="footer-sep">·</span>
            <span>{wordCount.chars} characters</span>
            <span className="footer-sep">·</span>
            <span>{wordCount.readTime} min read</span>
          </div>
        </div>
      </div>
    </main>
    {tableCtx && (
      <div className="table-ctx-menu" style={{ position: 'fixed', top: tableCtx.y, left: tableCtx.x, zIndex: 9999 }}>
        <button onClick={() => tableAction('add-row-above')}><i className="fa-solid fa-arrow-up"></i> Insert row above</button>
        <button onClick={() => tableAction('add-row-below')}><i className="fa-solid fa-arrow-down"></i> Insert row below</button>
        <div className="table-ctx-sep"></div>
        <button onClick={() => tableAction('add-col-left')}><i className="fa-solid fa-arrow-left"></i> Insert column left</button>
        <button onClick={() => tableAction('add-col-right')}><i className="fa-solid fa-arrow-right"></i> Insert column right</button>
        <div className="table-ctx-sep"></div>
        <button onClick={() => tableAction('delete-row')}><i className="fa-solid fa-trash"></i> Delete row</button>
        <button onClick={() => tableAction('delete-col')}><i className="fa-solid fa-trash"></i> Delete column</button>
        <div className="table-ctx-sep"></div>
        <button onClick={() => tableAction('delete-table')} className="table-ctx-danger"><i className="fa-solid fa-trash"></i> Delete table</button>
      </div>
    )}
    </>
  );
}
