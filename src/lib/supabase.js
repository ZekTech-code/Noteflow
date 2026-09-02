import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Transient network failures (ERR_CONNECTION_CLOSED, ECONNRESET, DNS...) are
// retried with exponential backoff so the client self-heals instead of hammering
// the API. Most auth calls whose request never reached the server are safe to
// retry; idempotent writes are, in practice, deduplicated upstream.
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY = 600;

async function fetchWithRetry(input, init) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
      if (err && err.name === 'AbortError') throw err;
      if (attempt >= MAX_RETRIES) break;
      const delay = RETRY_BASE_DELAY * 2 ** attempt + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// NOTE: the anon key and project URL are PUBLIC BY DESIGN. They are not
// secrets. Data protection is enforced by Supabase's Row Level Security (the
// service-role key — a real secret — is never used in this client).
if (!url || !anonKey) {
  console.warn('[NoteFlow] Missing Supabase env vars. VITE_SUPABASE_URL:', url ? 'set' : 'MISSING', 'VITE_SUPABASE_ANON_KEY:', anonKey ? 'set' : 'MISSING');
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, { global: { fetch: fetchWithRetry } })
  : null;

export function isCloudEnabled() {
  return !!supabase;
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session ?? null;
}

export async function signUp(email, password, name) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name || '',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function resetPassword(email) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
  return true;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function updateProfile(profile) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.updateUser({ data: profile });
  if (error) throw error;
  return data?.user ?? null;
}

// Persist the list of deleted note ids in the user's profile metadata so every
// device (and every new login) knows which notes must stay hidden, even if the
// note rows themselves still exist on the server.
export async function saveDeletedIds(ids) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.updateUser({ data: { deleted_ids: ids } });
  if (error) throw error;
}

export function getDeletedIds(user) {
  return Array.isArray(user && user.user_metadata && user.user_metadata.deleted_ids)
    ? user.user_metadata.deleted_ids
    : [];
}

export async function uploadAvatar(userId, file) {
  if (!supabase) throw new Error('Supabase is not configured');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/gi, '');
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  return `avatars/${path}`;
}

export function getAvatarUrl(path) {
  if (!supabase || !path) return '';
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data?.publicUrl ?? '';
}

export function onAuthStateChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
