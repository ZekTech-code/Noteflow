import DOMPurify from 'dompurify';

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'u', 's', 'strong', 'em', 'del', 'a', 'span', 'font',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'hr', 'img', 'div',
    'input',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel',
    'style', 'class', 'id',
    'src', 'alt', 'width', 'height',
    'colspan', 'rowspan',
    'type', 'checked', 'disabled', 'contenteditable',
    'data-tooltip', 'aria-label',
  ],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

export function sanitizeForExport(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ...PURIFY_CONFIG,
    ALLOWED_TAGS: [...PURIFY_CONFIG.ALLOWED_TAGS, 'div'],
    ALLOWED_ATTR: [...PURIFY_CONFIG.ALLOWED_ATTR, 'data-placeholder'],
  });
}
