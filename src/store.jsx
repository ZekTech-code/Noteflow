import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from 'react';
import { uid, stripHtml } from './utils';
import { loadTheme, saveTheme } from './lib/storage';
import {
  isCloudEnabled,
  onAuthStateChange,
  getSession,
  signUp,
  signIn,
  signOut,
  resetPassword,
  updateProfile,
  uploadAvatar,
  getAvatarUrl,
} from './lib/supabase';
import { pullRemote, pushNotes, mergeNotes, hardDeleteNotes, getDeletedIds, addDeletedId, removeDeletedIds } from './lib/sync';
import { exportAsPdf } from './lib/pdf';

const initialState = {
  notes: [],
  activeId: null,
  activeFilter: 'all',
  searchQuery: '',
  theme: 'dark',
  modal: null,
  sidebarOpen: false,
  toast: null,
  downloading: false,
  saveStatus: 'saved',
  syncStatus: 'offline',
  cloudEnabled: false,
  noNoteScreen: 'default',
  user: null,
  authLoading: true,
  loading: false,
  pendingAuth: false,
  transcriptPending: [],
  transcriptInterim: '',
  focusMode: false,
  speechLanguage: 'en-US',
  versions: {},
};

function init() {
  return {
    ...initialState,
    theme: loadTheme(),
    cloudEnabled: isCloudEnabled(),
    sidebarOpen: false,
  };
}

export function getFiltered(notes, activeFilter, searchQuery) {
  let list = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  if (activeFilter === 'archived') list = list.filter((n) => n.archived);
  else if (activeFilter === 'pinned') list = list.filter((n) => n.pinned && !n.archived);
  else if (activeFilter === 'all') list = list.filter((n) => !n.archived);
  else list = list.filter((n) => n.category === activeFilter && !n.archived);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(
      (n) =>
        stripHtml(n.title).toLowerCase().includes(q) ||
        stripHtml(n.content).toLowerCase().includes(q) ||
        n.tags.some((t) => t.includes(q)),
    );
  }
  return list;
}

function reducer(state, action) {
  switch (action.type) {
    case 'CREATE': {
      return { ...state, notes: [action.note, ...state.notes], activeId: action.note.id, modal: null, noNoteScreen: 'default' };
    }
    case 'OPEN':
      return { ...state, activeId: action.id, saveStatus: 'saved', noNoteScreen: 'default' };
    case 'UPDATE_CONTENT': {
      const updatedAt = new Date().toISOString();
      const cleanTitle = stripHtml(action.title || '');
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, title: cleanTitle, content: action.content, updatedAt } : n,
        ),
        saveStatus: 'saved',
      };
    }
    case 'TOGGLE_PIN': {
      const updatedAt = new Date().toISOString();
      return { ...state, notes: state.notes.map((n) => (n.id === action.id ? { ...n, pinned: !n.pinned, updatedAt } : n)) };
    }
    case 'SET_CATEGORY': {
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, category: action.category, updatedAt } : n)),
        modal: null,
      };
    }
    case 'ADD_TAG': {
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id && !n.tags.includes(action.tag) ? { ...n, tags: [...n.tags, action.tag], updatedAt } : n,
        ),
        modal: null,
      };
    }
    case 'REMOVE_TAG': {
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, tags: n.tags.filter((t) => t !== action.tag), updatedAt } : n,
        ),
      };
    }
    case 'SET_BG_COLOR': {
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, bgColor: action.color, updatedAt } : n)),
        modal: null,
      };
    }
    case 'SET_TITLE_ALIGN': {
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, titleAlign: action.align, updatedAt } : n)),
      };
    }
    case 'SAVE_VERSION': {
      const existing = state.versions[action.noteId] || [];
      const snapshot = { title: action.title, content: action.content, titleAlign: action.titleAlign, bgColor: action.bgColor, savedAt: action.savedAt };
      const updated = [snapshot, ...existing].slice(0, 50);
      return { ...state, versions: { ...state.versions, [action.noteId]: updated } };
    }
    case 'RESTORE_VERSION': {
      const v = action.snapshot;
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId ? { ...n, title: v.title, content: v.content, titleAlign: v.titleAlign || 'center', bgColor: v.bgColor || null, updatedAt: new Date().toISOString() } : n,
        ),
      };
    }
    case 'DELETE':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id), activeId: null, modal: null, saveStatus: 'saved', noNoteScreen: 'default' };
    case 'DUPLICATE':
      return { ...state, notes: [action.note, ...state.notes], activeId: action.note.id, modal: null };
    case 'TOGGLE_ARCHIVE': {
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, archived: !n.archived, pinned: n.archived ? n.pinned : false, updatedAt } : n,
        ),
        activeId: null,
        modal: null,
        noNoteScreen: 'default',
      };
    }
    case 'SAVE_AND_CLEAR':
      return { ...state, activeId: null, modal: null, saveStatus: 'saved', noNoteScreen: 'saved' };
    case 'SET_FILTER':
      return { ...state, activeFilter: action.filter };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.status };
    case 'SET_DOWNLOADING':
      return { ...state, downloading: action.downloading };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.status };
    case 'SET_CLOUD_ENABLED':
      return { ...state, cloudEnabled: action.enabled };
    case 'SET_USER':
      return { ...state, user: action.user, authLoading: false, cloudEnabled: !!action.user };
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_PENDING_AUTH':
      return { ...state, pendingAuth: action.pending };
    case 'OPEN_MODAL':
      return { ...state, modal: action.name };
    case 'CLOSE_MODAL':
      return { ...state, modal: null };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarOpen: false };
    case 'SHOW_TOAST':
      return { ...state, toast: { msg: action.msg, id: action.id, sticky: !!action.sticky, title: action.title || '' } };
    case 'HIDE_TOAST':
      return { ...state, toast: state.toast && state.toast.id === action.id ? null : state.toast };
    case 'MERGE_REMOTE':
      return { ...state, notes: action.notes };
    case 'SET_TRANSCRIPT_PENDING':
      return { ...state, transcriptPending: [...state.transcriptPending, action.text] };
    case 'SHIFT_TRANSCRIPT':
      return { ...state, transcriptPending: state.transcriptPending.slice(1) };
    case 'TOGGLE_FOCUS':
      return { ...state, focusMode: !state.focusMode };
    case 'SET_SPEECH_LANGUAGE':
      return { ...state, speechLanguage: action.lang };
    default:
      return state;
  }
}

function diffNotes(prev, next) {
  const prevMap = new Map(prev.map((n) => [n.id, n]));
  const nextMap = new Map(next.map((n) => [n.id, n]));
  const created = [];
  const updated = [];
  const deleted = [];
  nextMap.forEach((n, id) => {
    if (!prevMap.has(id)) created.push(id);
  });
  prevMap.forEach((n, id) => {
    if (!nextMap.has(id)) deleted.push(id);
  });
  nextMap.forEach((n, id) => {
    const p = prevMap.get(id);
    if (p && JSON.stringify(p) !== JSON.stringify(n)) updated.push(id);
  });
  return { created, updated, deleted };
}

const NotesContext = createContext(null);

// Ids of notes deleted locally but not yet confirmed removed from the cloud.
// They persist across reloads so a deleted note can never be resurrected: it
// stays hidden until the server confirms the row is gone, and the id is
// retried on every sync.
const PENDING_DELETED_KEY = 'noteflow:pending_deleted';

function loadPendingDeleted() {
  try {
    const raw = localStorage.getItem(PENDING_DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistPendingDeleted(pending) {
  try {
    localStorage.setItem(PENDING_DELETED_KEY, JSON.stringify([...pending]));
  } catch {
    // Storage may be unavailable; the in-memory set still protects this session.
  }
}

export function NotesProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  const stateRef = useRef(state);
  const notesRef = useRef(state.notes);
  const dirtyRef = useRef(new Set());
  const pendingDeleteRef = useRef(loadPendingDeleted());
  const saveTimerRef = useRef(null);
  const pushTimerRef = useRef(null);
  const pullTimerRef = useRef(null);
  const isDirtyRef = useRef(false);
  const editorHandleRef = useRef(null);
  const userIdRef = useRef(null);
  const pendingWelcomeRef = useRef(false);
  const pendingUserRef = useRef(null);
  const loadedUserIdRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    saveTheme(state.theme);
  }, [state.theme]);

  // Track the logged-in user's id so pushes are scoped to their account.
  useEffect(() => {
    userIdRef.current = state.user ? state.user.id : null;
  }, [state.user]);

  // Mark notes dirty for cloud push whenever they change locally.
  useEffect(() => {
    const prev = notesRef.current;
    if (prev === state.notes) return;
    const diff = diffNotes(prev, state.notes);
    notesRef.current = state.notes;
    diff.created.forEach((id) => dirtyRef.current.add(id));
    diff.updated.forEach((id) => dirtyRef.current.add(id));
    if (diff.created.length || diff.updated.length) schedulePush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.notes]);

  // Sign in / restore session, then load this user's notes from the cloud.
  useEffect(() => {
    let active = true;
    function startLoad(user) {
      if (!active) return;
      dispatch({ type: 'SET_USER', user });
      dispatch({ type: 'SET_LOADING', loading: true });
      Promise.all([flushPendingDeletes().catch(() => {}), getDeletedIds().catch(() => [])])
        .then(([, metadataIds]) => {
          if (!active) return;
          const deleted = new Set([...pendingDeleteRef.current, ...metadataIds]);
          return pullRemote().then((remote) => {
            if (!active) return;
            const live = remote.filter((n) => !deleted.has(n.id));
            notesRef.current = live;
            dispatch({ type: 'SET_NOTES', notes: live });
            dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });
            dispatch({ type: 'SET_LOADING', loading: false });
          });
        })
        .catch(() => {
          dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
          dispatch({ type: 'SET_LOADING', loading: false });
        });
    }
    async function bootstrap() {
      try {
        const session = await getSession();
        if (!active) return;
        if (session && session.user && !pendingWelcomeRef.current) {
          loadedUserIdRef.current = session.user.id;
          startLoad(session.user);
        } else if (!session) {
          dispatch({ type: 'SET_USER', user: null });
        }
      } catch {
        if (active) dispatch({ type: 'SET_USER', user: null });
      }
    }
    const unsubscribe = onAuthStateChange((user) => {
      if (!active) return;
      if (user) {
        // A fresh login/signup waits for the OK toast before loading notes.
        if (pendingWelcomeRef.current) {
          pendingUserRef.current = user;
          dispatch({ type: 'SET_PENDING_AUTH', pending: true });
          return;
        }
        // Restore of an existing session.
        if (loadedUserIdRef.current === user.id) return;
        loadedUserIdRef.current = user.id;
        startLoad(user);
      } else {
        pendingWelcomeRef.current = false;
        pendingUserRef.current = null;
        loadedUserIdRef.current = null;
        dispatch({ type: 'SET_USER', user: null });
        notesRef.current = [];
        dirtyRef.current.clear();
        dispatch({ type: 'SET_NOTES', notes: [] });
        dispatch({ type: 'SET_SYNC_STATUS', status: 'offline' });
        dispatch({ type: 'SET_LOADING', loading: false });
        dispatch({ type: 'SET_PENDING_AUTH', pending: false });
      }
    });
    bootstrap();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const showToast = useCallback((msg, sticky = false, title = '') => {
    const id = Date.now() + Math.random();
    dispatch({ type: 'SHOW_TOAST', msg, id, sticky, title });
    if (!sticky) setTimeout(() => dispatch({ type: 'HIDE_TOAST', id }), 3000);
  }, []);

  const dismissToast = useCallback((id) => {
    dispatch({ type: 'HIDE_TOAST', id });
  }, []);

  const flushNow = useCallback((id) => {
    const h = editorHandleRef.current;
    if (h && h.id === id) {
      dispatch({ type: 'UPDATE_CONTENT', id, title: h.getTitle(), content: h.getContent() });
    }
    clearTimeout(saveTimerRef.current);
    isDirtyRef.current = false;
  }, []);

  const onEdit = useCallback((id) => {
    isDirtyRef.current = true;
    dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const h = editorHandleRef.current;
      if (h && h.id === id) {
        dispatch({ type: 'UPDATE_CONTENT', id, title: h.getTitle(), content: h.getContent() });
      }
      isDirtyRef.current = false;
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' });
    }, 800);
  }, []);

  const schedulePush = useCallback(() => {
    if (!userIdRef.current) return;
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(pushNow, 800);
  }, []);

  async function pushNow() {
    if (!userIdRef.current) return;
    if (dirtyRef.current.size === 0 && pendingDeleteRef.current.size === 0) return;
    try {
      if (dirtyRef.current.size > 0) {
        const ids = [...dirtyRef.current];
        await pushNotes(notesRef.current.filter((n) => ids.includes(n.id)));
        dirtyRef.current.clear();
        for (const n of notesRef.current.filter((n) => ids.includes(n.id))) {
          dispatch({ type: 'SAVE_VERSION', noteId: n.id, title: n.title, content: n.content, titleAlign: n.titleAlign || 'center', bgColor: n.bgColor, savedAt: new Date().toISOString() });
        }
      }
      const deletedIds = [...pendingDeleteRef.current];
      await flushPendingDeletes();
      if (deletedIds.length) removeDeletedIds(deletedIds).catch(() => {});
      dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });
    } catch {
      dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
    }
  }

  // Tell the cloud a note was deleted. Idempotent: retried on every sync until
  // it succeeds, and pending ids are filtered from every pull/merge so a
  // deleted note can never reappear after a refresh.
  async function flushPendingDeletes() {
    if (pendingDeleteRef.current.size === 0) return;
    const ids = [...pendingDeleteRef.current];
    await hardDeleteNotes(ids);
    pendingDeleteRef.current.clear();
    persistPendingDeleted(pendingDeleteRef.current);
  }

  async function runSync() {
    if (!userIdRef.current) return;
    try {
      const pendingDirty = [...dirtyRef.current];
      if (pendingDirty.length) {
        await pushNotes(notesRef.current.filter((n) => pendingDirty.includes(n.id)));
        for (const n of notesRef.current.filter((n) => pendingDirty.includes(n.id))) {
          dispatch({ type: 'SAVE_VERSION', noteId: n.id, title: n.title, content: n.content, titleAlign: n.titleAlign || 'center', bgColor: n.bgColor, savedAt: new Date().toISOString() });
        }
        pendingDirty.forEach((id) => dirtyRef.current.delete(id));
      }
      // Capture the local pending IDs before the flush clears them. These are
      // the only ones we will actually hard-delete and remove from metadata.
      const localPending = [...pendingDeleteRef.current];
      // Read the server-side deleted IDs so any deletions from other devices
      // are honoured here, and push any local-only pending IDs to the server.
      const metadataIds = await getDeletedIds().catch(() => []);
      const mergedDeleted = new Set([...localPending, ...metadataIds]);
      for (const id of localPending) {
        if (!metadataIds.includes(id)) addDeletedId(id).catch(() => {});
      }
      await flushPendingDeletes();
      const remote = await pullRemote();
      const { merged, localWinners } = mergeNotes(notesRef.current, remote);
      if (localWinners.length) {
        await pushNotes(localWinners);
        for (const n of localWinners) {
          dispatch({ type: 'SAVE_VERSION', noteId: n.id, title: n.title, content: n.content, titleAlign: n.titleAlign || 'center', bgColor: n.bgColor, savedAt: new Date().toISOString() });
        }
      }
      // Only remove IDs we actually hard-deleted from the server. IDs that
      // came from metadata (deleted by another device) must stay there.
      if (localPending.length) removeDeletedIds(localPending).catch(() => {});
      const finalNotes = merged.filter((n) => !mergedDeleted.has(n.id));
      notesRef.current = finalNotes;
      dispatch({ type: 'SET_NOTES', notes: finalNotes });
      dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });
    } catch {
      dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
    }
  }

  // Initial sync + periodic refresh while the app is open.
  useEffect(() => {
    runSync();
    const onVis = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    document.addEventListener('visibilitychange', onVis);
    pullTimerRef.current = setInterval(runSync, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(pullTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush the active editor and push every pending change to the cloud
  // (used to make sure nothing is lost when the user logs out).
  async function pushPending() {
    const id = stateRef.current.activeId;
    const h = editorHandleRef.current;
    const pushIds = new Set(dirtyRef.current);
    if (id) pushIds.add(id);
    let toPush = [...pushIds].map((nid) => notesRef.current.find((n) => n.id === nid)).filter(Boolean);
    if (h && h.id === id) {
      const src = stateRef.current.notes.find((n) => n.id === id);
      if (src) {
        const fresh = { ...src, title: h.getTitle(), content: h.getContent() };
        const idx = toPush.findIndex((n) => n.id === id);
        if (idx >= 0) toPush[idx] = fresh;
        else toPush.push(fresh);
      }
    }
    if (!userIdRef.current) return;
    if (toPush.length) {
      await pushNotes(toPush);
      for (const n of toPush) {
        dispatch({ type: 'SAVE_VERSION', noteId: n.id, title: n.title, content: n.content, titleAlign: n.titleAlign || 'center', bgColor: n.bgColor, savedAt: new Date().toISOString() });
      }
    }
    await flushPendingDeletes();
  }

  // Warn before losing unsaved edits.
  useEffect(() => {
    const handler = (e) => {
      if (isDirtyRef.current || dirtyRef.current.size > 0 || pendingDeleteRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Ctrl/Cmd+N shortcut.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        dispatch({ type: 'OPEN_MODAL', name: 'new' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const actions = useMemo(
    () => ({
      registerEditor: (handle) => {
        editorHandleRef.current = handle;
      },
      login: async (email, password) => {
        pendingWelcomeRef.current = true;
        try {
          const data = await signIn(email, password);
          pendingUserRef.current = data.user;
          dispatch({ type: 'SET_PENDING_AUTH', pending: true });
          return { ok: true, user: data.user };
        } catch (err) {
          pendingWelcomeRef.current = false;
          return { ok: false, error: err.message || 'Could not sign in' };
        }
      },
      signup: async (email, password, name) => {
        try {
          const data = await signUp(email, password, name);
          await signOut();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err.message || 'Could not sign up' };
        }
      },
      resetPassword: async (email) => {
        try {
          await resetPassword(email);
          return { ok: true, message: 'Reset link sent. Check your email.' };
        } catch (err) {
          return { ok: false, error: err.message || 'Could not send reset link' };
        }
      },
      logout: async ({ discard = false } = {}) => {
        if (!discard) {
          try {
            await pushPending();
          } catch {
            // Best effort: still log out even if the final cloud push fails.
          }
        }
        await signOut();
        dirtyRef.current.clear();
        notesRef.current = [];
        dispatch({ type: 'SET_USER', user: null });
        dispatch({ type: 'SET_NOTES', notes: [] });
        dispatch({ type: 'SET_SYNC_STATUS', status: 'offline' });
        showToast('Signed out');
      },
      hasUnsavedChanges: () => isDirtyRef.current || stateRef.current.saveStatus === 'saving',
      updateProfile: async ({ fullName, avatarUrl }) => {
        const profile = {};
        if (fullName !== undefined) profile.full_name = fullName;
        if (avatarUrl !== undefined) profile.avatar_url = avatarUrl;
        try {
          const user = await updateProfile(profile);
          dispatch({ type: 'SET_USER', user });
          return { ok: true, user };
        } catch (err) {
          return { ok: false, error: err.message || 'Could not update profile' };
        }
      },
      uploadAvatar: async (file) => {
        const user = stateRef.current.user;
        if (!user) return { ok: false, error: 'Not signed in' };
        try {
          const path = await uploadAvatar(user.id, file);
          const avatarUrl = getAvatarUrl(path);
          const updated = await updateProfile({ avatar_url: avatarUrl });
          dispatch({ type: 'SET_USER', user: updated });
          return { ok: true, user: updated, avatarUrl };
        } catch (err) {
          return { ok: false, error: err.message || 'Could not upload image' };
        }
      },
      completeWelcome: async () => {
        pendingWelcomeRef.current = false;
        const user = pendingUserRef.current;
        pendingUserRef.current = null;
        dispatch({ type: 'SET_PENDING_AUTH', pending: false });
        if (user) {
          loadedUserIdRef.current = user.id;
          dispatch({ type: 'SET_USER', user });
          dispatch({ type: 'SET_LOADING', loading: true });
          try {
            await flushPendingDeletes();
            const metadataIds = await getDeletedIds().catch(() => []);
            const deleted = new Set([...pendingDeleteRef.current, ...metadataIds]);
            const remote = await pullRemote();
            const live = remote.filter((n) => !deleted.has(n.id));
            notesRef.current = live;
            dispatch({ type: 'SET_NOTES', notes: live });
            dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });
          } catch {
            dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
          } finally {
            dispatch({ type: 'SET_LOADING', loading: false });
          }
        }
      },
      createNote: ({ title, category, content }) => {
        const safeTitle = String(title || 'Untitled').substring(0, 200);
        const safeCategory = ['work', 'personal', 'ideas'].includes(category) ? category : 'personal';
        const safeContent = String(content || '').substring(0, 500000);
        const now = new Date().toISOString();
        const note = { id: uid(), title: safeTitle, content: safeContent, category: safeCategory, tags: [], pinned: false, archived: false, bgColor: null, titleAlign: 'center', createdAt: now, updatedAt: now };
        dispatch({ type: 'CREATE', note });
        showToast('Note created!');
      },
      openNote: (id) => {
        dispatch({ type: 'OPEN', id });
        if (window.innerWidth <= 768) dispatch({ type: 'CLOSE_SIDEBAR' });
      },
      togglePin: () => {
        const id = stateRef.current.activeId;
        if (!id) return;
        flushNow(id);
        dispatch({ type: 'TOGGLE_PIN', id });
        const n = stateRef.current.notes.find((x) => x.id === id);
        showToast(n && n.pinned ? 'Note unpinned' : 'Note pinned');
      },
      duplicate: () => {
        const id = stateRef.current.activeId;
        if (!id) return;
        flushNow(id);
        const src = stateRef.current.notes.find((x) => x.id === id);
        if (!src) return;
        const h = editorHandleRef.current;
        const now = new Date().toISOString();
        const copy = {
          ...src,
          id: uid(),
          title: stripHtml(h && h.id === id ? h.getTitle() : src.title) + ' (copy)',
          content: h && h.id === id ? h.getContent() : src.content,
          pinned: false,
          createdAt: now,
          updatedAt: now,
        };
        dispatch({ type: 'DUPLICATE', note: copy });
        showToast('Note duplicated');
      },
      deleteNote: () => {
        const id = stateRef.current.activeId;
        if (!id) return;
        clearTimeout(saveTimerRef.current);
        isDirtyRef.current = false;
        dirtyRef.current.delete(id);
        pendingDeleteRef.current.add(id);
        persistPendingDeleted(pendingDeleteRef.current);
        editorHandleRef.current = null;
        dispatch({ type: 'DELETE', id });
        addDeletedId(id).then((user) => { if (user) dispatch({ type: 'SET_USER', user }); });
        schedulePush();
        showToast('Note deleted');
      },
      toggleArchive: () => {
        const id = stateRef.current.activeId;
        if (!id) return;
        flushNow(id);
        dispatch({ type: 'TOGGLE_ARCHIVE', id });
        const n = stateRef.current.notes.find((x) => x.id === id);
        showToast(n && n.archived ? 'Note restored' : 'Note archived');
      },
      setCategory: (id, category) => {
        flushNow(id);
        dispatch({ type: 'SET_CATEGORY', id, category });
        showToast('Category updated');
      },
      addTag: (id, tag) => {
        const safeTag = String(tag || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30);
        if (!safeTag) return;
        flushNow(id);
        dispatch({ type: 'ADD_TAG', id, tag: safeTag });
        showToast(`#${safeTag} added`);
      },
      removeTag: (id, tag) => {
        flushNow(id);
        dispatch({ type: 'REMOVE_TAG', id, tag });
        showToast('Tag removed');
      },
      setBgColor: (id, color) => {
        dispatch({ type: 'SET_BG_COLOR', id, color });
        showToast('Background updated');
      },
      setTitleAlign: (id, align) => {
        dispatch({ type: 'SET_TITLE_ALIGN', id, align });
      },
      saveVersion: (noteId) => {
        const note = stateRef.current.notes.find((n) => n.id === noteId);
        if (!note) return;
        dispatch({ type: 'SAVE_VERSION', noteId, title: note.title, content: note.content, titleAlign: note.titleAlign || 'center', bgColor: note.bgColor, savedAt: new Date().toISOString() });
      },
      restoreVersion: (noteId, snapshot) => {
        dispatch({ type: 'RESTORE_VERSION', noteId, snapshot });
        schedulePush();
        showToast('Version restored');
      },
      saveNote: () => {
        const id = stateRef.current.activeId;
        if (!id) return;
        flushNow(id);
        showToast('Note saved');
      },
      download: async () => {
        const id = stateRef.current.activeId;
        if (!id) return;
        flushNow(id);
        const h = editorHandleRef.current;
        const src = stateRef.current.notes.find((x) => x.id === id) || {};
        const title = h && h.id === id ? h.getTitle() : src.title;
        const content = h && h.id === id ? h.getContent() : src.content;
        dispatch({ type: 'SET_DOWNLOADING', downloading: true });
        try {
          await exportAsPdf({
            title: title || 'Untitled',
            content,
            category: src.category,
            tags: src.tags || [],
            updatedAt: src.updatedAt,
            bgColor: src.bgColor,
            filename: stripHtml(src.title || 'note').replace(/[^a-z0-9]/gi, '_') + '.pdf',
          });
          showToast('PDF downloaded!');
        } catch (err) {
          showToast('Could not generate PDF');
        } finally {
          dispatch({ type: 'SET_DOWNLOADING', downloading: false });
        }
      },
      setFilter: (filter) => dispatch({ type: 'SET_FILTER', filter }),
      setSearch: (query) => dispatch({ type: 'SET_SEARCH', query }),
      setTheme: (theme) => dispatch({ type: 'SET_THEME', theme }),
      openModal: (name) => dispatch({ type: 'OPEN_MODAL', name }),
      closeModal: () => dispatch({ type: 'CLOSE_MODAL' }),
      toggleSidebar: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
      closeSidebar: () => dispatch({ type: 'CLOSE_SIDEBAR' }),
      showToast,
      dismissToast,
      onEdit,
      flushNow,
      setTranscriptPending: (text) => dispatch({ type: 'SET_TRANSCRIPT_PENDING', text }),
      shiftTranscript: () => dispatch({ type: 'SHIFT_TRANSCRIPT' }),
      toggleFocus: () => dispatch({ type: 'TOGGLE_FOCUS' }),
      setSpeechLanguage: (lang) => dispatch({ type: 'SET_SPEECH_LANGUAGE', lang }),
    }),
    [flushNow, onEdit, showToast, dismissToast],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used within NotesProvider');
  return ctx;
}
