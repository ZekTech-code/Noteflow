export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  return div.textContent || '';
}

export function catLabel(cat) {
  return { work: 'Work', personal: 'Personal', ideas: 'Ideas' }[cat] || cat || '—';
}

export function wordCount(html) {
  const text = stripHtml(html).trim().replace(/\s+/g, ' ');
  return text ? text.split(' ').length : 0;
}

export function readTime(words) {
  return Math.max(1, Math.ceil(words / 200));
}
