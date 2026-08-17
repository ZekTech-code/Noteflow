import { supabase } from './supabase';

function toRow(n) {
  return {
    id: n.id,
    title: n.title || '',
    content: n.content || '',
    category: n.category || 'work',
    tags: n.tags || [],
    pinned: !!n.pinned,
    archived: !!n.archived,
    bg_color: n.bgColor || null,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

function fromRow(r) {
  return {
    id: r.id,
    title: r.title || '',
    content: r.content || '',
    category: r.category || 'work',
    tags: Array.isArray(r.tags) ? r.tags : [],
    pinned: !!r.pinned,
    archived: !!r.archived,
    bgColor: r.bg_color || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function pullRemote() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function pushNotes(notes) {
  if (notes.length) {
    const { error } = await supabase.from('notes').upsert(notes.map(toRow), { onConflict: 'id' });
    if (error) throw error;
  }
}

// Permanently remove notes from the cloud. Idempotent: deleting ids that no
// longer exist is a no-op, so it is safe to call repeatedly.
export async function hardDeleteNotes(ids) {
  if (ids.length) {
    const { error } = await supabase.from('notes').delete().in('id', ids);
    if (error) throw error;
  }
}

// Deleted-note IDs are stored in the user's Supabase auth metadata so they
// persist across devices without any extra database tables.

export async function getDeletedIds() {
  if (!supabase) return [];
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.deleted_ids || [];
  } catch {
    return [];
  }
}

export async function addDeletedId(id) {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const current = user?.user_metadata?.deleted_ids || [];
    if (current.includes(id)) return null;
    const { data } = await supabase.auth.updateUser({ data: { deleted_ids: [...current, id] } });
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function removeDeletedIds(ids) {
  if (!supabase || !ids.length) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const current = user?.user_metadata?.deleted_ids || [];
    const remaining = current.filter((did) => !ids.includes(did));
    const { data } = await supabase.auth.updateUser({ data: { deleted_ids: remaining } });
    return data?.user ?? null;
  } catch {
    return null;
  }
}

// Last-write-wins merge by updatedAt. Returns the visible list and which of
// those entries came from local (so they can be pushed up to the cloud).
export function mergeNotes(local, remote) {
  const byId = new Map();
  for (const n of local) byId.set(n.id, n);
  for (const r of remote) {
    const existing = byId.get(r.id);
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) {
      byId.set(r.id, r);
    }
  }
  const merged = [...byId.values()];
  const localWinners = merged.filter((m) => {
    const l = local.find((n) => n.id === m.id);
    return !!l && new Date(l.updatedAt) >= new Date(m.updatedAt);
  });
  return { merged, localWinners };
}
