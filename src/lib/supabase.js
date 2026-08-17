import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

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
