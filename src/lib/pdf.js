const MARGIN = 50;
const PAGE_WIDTH = 595; // A4
const PAGE_HEIGHT = 842; // A4
const FONT_SIZE = 11;
const LINE_HEIGHT = 15;

// Map common Unicode punctuation to WinAnsi (CP1252) byte values so it
// renders correctly in Helvetica-based PDFs.
const WINANSI = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b,
  0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x017e: 0x9e,
  0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x0178: 0x9f, 0x00a0: 0xa0,
};

function pdfSafe(text) {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    const mapped = WINANSI[code];
    if (mapped !== undefined) out += String.fromCharCode(mapped);
    else if (code < 256) out += ch;
    else out += '?';
  }
  return out;
}

function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');

  function walk(node, depth) {
    let text = '';
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        text += child.textContent;
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') {
        text += '\n';
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        text += list(child, depth);
        return;
      }
      if (tag === 'li') {
        text += walk(child, depth);
        return;
      }
      if (tag === 'p' || tag === 'div') {
        text += walk(child, depth).trim() + '\n\n';
        return;
      }
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table', 'tr'].includes(tag)) {
        text += walk(child, depth).trim() + '\n';
        return;
      }
      // Inline formatting (strong, em, a, span, code, mark, …)
      text += walk(child, depth);
    });
    return text;
  }

  function list(el, depth) {
    const ordered = el.tagName.toLowerCase() === 'ol';
    let num = parseInt(el.getAttribute('start'), 10) || 1;
    let text = '';
    Array.from(el.children).forEach((li) => {
      if (li.tagName.toLowerCase() !== 'li') return;
      const indent = '   '.repeat(depth);
      const marker = ordered ? `${indent}${num}. ` : `${indent}• `;
      text += '\n' + marker + walk(li, depth + 1).trim();
      num += 1;
    });
    text += '\n';
    return text;
  }

  let out = walk(doc.body, 0);
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

function splitLines(text, maxWidth) {
  // Approximate glyph width: 0.5 * fontSize per character.
  const maxChars = Math.floor(maxWidth / (FONT_SIZE * 0.5));
  const lines = [];
  for (const raw of String(text).split('\n')) {
    const indent = (raw.match(/^\s*/) || [''])[0];
    const words = raw.trim().split(' ');
    let current = indent;
    for (const word of words) {
      if (!word) continue;
      const candidate = current === indent ? indent + word : current + ' ' + word;
      if (candidate.length > maxChars && current !== indent) {
        lines.push(current);
        current = indent + word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

function hexToRgb(hex) {
  if (!hex) return null;
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (isNaN(n) || n > 0xffffff) return null;
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

function luminance(hex) {
  const c = String(hex || '').replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = parseInt(full, 16);
  if (isNaN(n)) return 0.5;
  return (
    0.2126 * (((n >> 16) & 255) / 255) +
    0.7152 * (((n >> 8) & 255) / 255) +
    0.0722 * ((n & 255) / 255)
  );
}

export async function exportAsPdf({ title, content, category, tags, updatedAt, bgColor, filename }) {
  const titleLines = splitLines(htmlToText(title) || 'Untitled', PAGE_WIDTH - MARGIN * 2);
  const body = splitLines(htmlToText(content), PAGE_WIDTH - MARGIN * 2);
  const bg = hexToRgb(bgColor);
  const bgCmd = bg
    ? `q ${bg.r} ${bg.g} ${bg.b} rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f Q\n`
    : '';
  const bgLum = bg ? 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b : 1;
  const textGray = bgLum > 0.45 ? 0 : 1;
  const metaGray = textGray === 0 ? 0.4 : 0.65;

  const pageStreams = [[]];
  let pageIdx = 0;
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    pageStreams.push([]);
    pageIdx = pageStreams.length - 1;
    y = PAGE_HEIGHT - MARGIN;
  }

  function draw(line, size, color, advance) {
    if (y - advance < MARGIN) newPage();
    pageStreams[pageIdx].push(
      `BT /F1 ${size} Tf ${color} g 1 0 0 1 ${MARGIN} ${y} Tm (${escapeText(pdfSafe(line))}) Tj ET`,
    );
    y -= advance;
  }

  // Title
  for (const line of titleLines) draw(line, 16, textGray, 22);
  y -= 8;

  // Meta line
  const metaBits = [];
  if (category) metaBits.push(category);
  if (Array.isArray(tags) && tags.length) metaBits.push('#' + tags.join(' #'));
  if (updatedAt) metaBits.push(new Date(updatedAt).toLocaleDateString());
  if (metaBits.length) draw(metaBits.join('  |  '), 8, metaGray, 24);

  // Body
  for (const line of body) {
    if (line.trim()) {
      draw(line, FONT_SIZE, textGray, LINE_HEIGHT);
    } else {
      if (y - 10 < MARGIN) newPage();
      y -= 10;
    }
  }

  const n = pageStreams.length;
  const kids = Array.from({ length: n }, (_, k) => `${3 + k} 0 R`).join(' ');
  const objectsData = [
    { dict: `<< /Type /Catalog /Pages 2 0 R >>` },
    { dict: `<< /Type /Pages /Kids [${kids}] /Count ${n} >>` },
  ];
  for (let k = 0; k < n; k++) {
    objectsData.push({
      dict: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${3 + n} 0 R >> >> /Contents ${4 + n + k} 0 R >>`,
    });
  }
  objectsData.push({ dict: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>` });
  for (const stream of pageStreams) {
    const content = bgCmd + (stream.length ? 'q\n' + stream.join('\n') + '\nQ' : 'q\nQ');
    objectsData.push({ dict: `<< /Length ${content.length} >>`, stream: content });
  }

  const bytes = [];
  function push(str) {
    for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff);
  }

  push('%PDF-1.4\n');
  const offsets = [];
  objectsData.forEach((obj, i) => {
    offsets.push(bytes.length);
    push(`${i + 1} 0 obj\n`);
    push(`${obj.dict}\n`);
    if (obj.stream) push(`stream\n${obj.stream}\nendstream\n`);
    push(`endobj\n`);
  });
  const xrefStart = bytes.length;
  push(`xref\n0 ${objectsData.length + 1}\n0000000000 65535 f \n`);
  for (const pos of offsets) {
    push(`${String(pos).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectsData.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const name = filename || 'note.pdf';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return true;
}
