import { sanitizeForExport } from './sanitize';

function readableTextColor(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (isNaN(n)) return '#1a1a22';
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111111' : '#ffffff';
}

function flattenDivs(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  let changed = true;
  while (changed) {
    changed = false;
    const divs = tmp.querySelectorAll('div');
    for (const div of divs) {
      if (div.parentNode && div.parentNode !== tmp) {
        const parent = div.parentNode;
        while (div.firstChild) {
          parent.insertBefore(div.firstChild, div);
        }
        parent.removeChild(div);
        changed = true;
        break;
      }
    }
  }
  return tmp.innerHTML;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizeFilename(name) {
  return (name || 'untitled').replace(/[<>:"/\\|?*]/g, '_').substring(0, 80);
}

function htmlToPlainText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = flattenDivs(html);

  function processNode(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(processNode).join('');

    switch (tag) {
      case 'br': return '\n';
      case 'h1': case 'h2': case 'h3':
        return `\n${children.toUpperCase()}\n${'='.repeat(Math.min(children.length, 40))}\n`;
      case 'p': return `\n${children}\n`;
      case 'blockquote': return `\n> ${children}\n`;
      case 'pre': return `\n${children}\n`;
      case 'code': return children;
      case 'ul': case 'ol': return '\n' + children;
      case 'li': return `\n  \u2022 ${children}`;
      case 'hr': return '\n' + '-'.repeat(40) + '\n';
      case 'strong': case 'b': return children.toUpperCase();
      case 'em': case 'i': return children;
      case 'u': return children;
      case 's': case 'del': return children;
      case 'img': return '';
      case 'a': return children;
      case 'table': {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (!rows.length) return children;
        const colWidths = [];
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          cells.forEach((c, i) => {
            const len = c.textContent.trim().length;
            colWidths[i] = Math.max(colWidths[i] || 4, len);
          });
        });
        let table = '\n';
        rows.forEach((row, ri) => {
          const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.textContent.trim());
          table += '| ' + cells.map((c, i) => c.padEnd(colWidths[i] || 4)).join(' | ') + ' |\n';
          if (ri === 0) {
            table += '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |\n';
          }
        });
        return table + '\n';
      }
      case 'thead': case 'tbody': case 'tr':
        return children;
      case 'td': case 'th':
        return children;
      default: return children;
    }
  }

  return processNode(tmp).replace(/\n{3,}/g, '\n\n').trim();
}

export function exportAsPdf(title, titleHtml, contentHtml, bgColor, titleAlign) {
  const align = titleAlign || 'center';
  const plainTitle = (title || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const titleBlock = plainTitle ? `<div style="font-weight:bold;font-size:1.8rem;margin-bottom:0.5em;text-align:${align};">${escapeHtml(plainTitle)}</div>` : '';
  const cleanHtml = sanitizeForExport(flattenDivs(contentHtml || ''));
  const textColor = bgColor ? readableTextColor(bgColor) : '#1a1a22';
  const bgStyle = bgColor ? `background:${bgColor};color:${textColor};` : '';
  const html = `<!DOCTYPE html>
<html><head><title>${escapeHtml(plainTitle)}</title>
<style>
  @page { margin: 0; size: A4; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Inter', 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 60px; line-height: 1.7; color: #1a1a22; ${bgStyle} }
  h1 { font-size: 1.8rem; margin-bottom: 0.3em; }
  h2 { font-size: 1.4rem; }
  h3 { font-size: 1.15rem; }
  blockquote { border-left: 3px solid #ccc; padding-left: 12px; color: #555; margin: 12px 0; }
  pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f8f8f8; font-weight: 600; }
  img { max-width: 100%; }
  @media print {
    body { margin: 0; ${bgStyle} }
    @page { margin: 0; }
  }
</style></head><body>
  ${titleBlock}
  <div class="content">${cleanHtml}</div>
</body></html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.title = plainTitle || 'Note';
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}

export function exportAsText(title, contentHtml) {
  const text = htmlToPlainText(contentHtml || '');
  const full = `${title}\n${'='.repeat(title.length)}\n\n${text}`;
  const blob = new Blob([full], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(title)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
