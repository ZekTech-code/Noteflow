import { useEffect, useRef, useState } from 'react';
import { useNotes } from '../store';
import { NOTE_TEMPLATES } from '../lib/templates';

const CATEGORIES = [
  { val: 'work', label: 'Work', icon: 'fa-solid fa-briefcase' },
  { val: 'personal', label: 'Personal', icon: 'fa-solid fa-user' },
  { val: 'ideas', label: 'Ideas', icon: 'fa-solid fa-lightbulb' },
];

function ModalShell({ icon, title, subtitle, onClose, children, footer }) {
  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>
          <i className={icon} style={{ color: 'var(--accent)', marginRight: 8 }}></i>
          {title}
        </h3>
        <p>{subtitle}</p>
        {children}
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}

function NewNoteModal() {
  const { actions } = useNotes();
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('work');
  const [templateId, setTemplateId] = useState('blank');
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const tpl = NOTE_TEMPLATES.find((t) => t.id === templateId) || NOTE_TEMPLATES[0];
  const create = () => actions.createNote({ title: title.trim() || tpl.title || 'Untitled', category: cat, content: tpl.content });

  return (
    <ModalShell
      icon="fa-solid fa-pen-to-square"
      title="New Note"
      subtitle="Choose a template or start from scratch."
      onClose={() => actions.closeModal()}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => actions.closeModal()}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={create}>
            Create Note
          </button>
        </>
      }
    >
      <input
        ref={inputRef}
        className="modal-input"
        type="text"
        placeholder="Note title…"
        maxLength={80}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
      />
      <div className="template-grid">
        {NOTE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`template-btn${templateId === t.id ? ' active' : ''}`}
            onClick={() => setTemplateId(t.id)}
          >
            <i className={t.icon}></i>
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      <div className="cat-picker">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c.val}
            className={`cat-pick-btn${cat === c.val ? ' active' : ''}`}
            onPointerDown={() => setCat(c.val)}
            onClick={() => setCat(c.val)}
          >
            <i className={c.icon}></i> {c.label}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function CategoryModal({ note }) {
  const { actions } = useNotes();
  const [cat, setCat] = useState(note.category);

  return (
    <ModalShell
      icon="fa-solid fa-tag"
      title="Change Category"
      subtitle="Move this note to a different category."
      onClose={() => actions.closeModal()}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => actions.closeModal()}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => actions.setCategory(note.id, cat)}>
            Apply
          </button>
        </>
      }
    >
      <div className="cat-picker">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c.val}
            className={`cat-pick-btn${cat === c.val ? ' active' : ''}`}
            onPointerDown={() => setCat(c.val)}
            onClick={() => setCat(c.val)}
          >
            <i className={c.icon}></i> {c.label}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function TagModal({ note }) {
  const { actions } = useNotes();
  const [tag, setTag] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const apply = () => {
    const raw = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (raw) actions.addTag(note.id, raw);
  };

  return (
    <ModalShell
      icon="fa-solid fa-hashtag"
      title="Add Tag"
      subtitle="Add a short label to help organise this note."
      onClose={() => actions.closeModal()}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => actions.closeModal()}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={apply}>
            Add Tag
          </button>
        </>
      }
    >
      <input
        ref={inputRef}
        className="modal-input"
        type="text"
        placeholder="e.g. urgent, meeting, draft…"
        maxLength={24}
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
      />
    </ModalShell>
  );
}

function DeleteModal() {
  const { actions } = useNotes();
  return (
    <ModalShell
      icon="fa-solid fa-triangle-exclamation"
      title="Delete Note"
      subtitle="This will permanently delete the note. Are you sure?"
      onClose={() => actions.closeModal()}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => actions.closeModal()}>
            Keep It
          </button>
          <button className="btn" style={{ background: 'var(--accent)', color: '#111' }} onClick={() => actions.deleteNote()}>
            Yes, Delete
          </button>
        </>
      }
    />
  );
}

function ArchiveModal({ note }) {
  const { actions } = useNotes();
  const isArchived = !!note.archived;
  return (
    <ModalShell
      icon={isArchived ? 'fa-solid fa-box-open' : 'fa-solid fa-box-archive'}
      title={isArchived ? 'Unarchive Note' : 'Archive Note'}
      subtitle={
        isArchived
          ? 'This note will be restored and visible in its category again.'
          : 'This note will be moved to the Archive. You can restore it any time.'
      }
      onClose={() => actions.closeModal()}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => actions.closeModal()}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => actions.toggleArchive()}>
            <i className={isArchived ? 'fa-solid fa-box-open' : 'fa-solid fa-box-archive'}></i>
            {isArchived ? ' Unarchive' : ' Archive'}
          </button>
        </>
      }
    />
  );
}

function ProfileModal() {
  const { state, actions } = useNotes();
  const user = state.user || {};
  const meta = user.user_metadata || {};
  const [fullName, setFullName] = useState(meta.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(meta.avatar_url || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const initial = (fullName.trim() || user.email || 'U').charAt(0).toUpperCase();

  const save = async () => {
    const name = fullName.trim();
    if (!name) {
      setMsg('Name cannot be empty.');
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await actions.updateProfile({ fullName: name });
    setBusy(false);
    setMsg(res.ok ? 'Profile saved' : res.error);
  };

  const pickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg('Image must be under 2 MB.');
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await actions.uploadAvatar(file);
    setBusy(false);
    if (res.ok) {
      setAvatarUrl(res.avatarUrl);
      setMsg('Profile picture updated');
    } else {
      setMsg(res.error);
    }
  };

  return (
    <ModalShell
      icon="fa-solid fa-user-gear"
      title="Profile & Settings"
      subtitle="Manage your account and profile picture."
      onClose={() => actions.closeModal()}
      footer={
        <>
          <button className="btn" style={{ background: 'var(--accent)', color: '#111' }} onClick={() => actions.logout()}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Log out
          </button>
          <span className="modal-footer-spacer"></span>
          <button className="btn btn-ghost" onClick={() => actions.closeModal()}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="profile-head">
        <div className="profile-avatar">
          {avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span>{initial}</span>}
          <button type="button" className="profile-avatar-edit" data-tooltip="Upload photo" aria-label="Upload photo" onClick={() => fileRef.current && fileRef.current.click()}>
            <i className="fa-solid fa-camera"></i>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
        </div>
        <p className="profile-email">{user.email || ''}</p>
      </div>

      <label className="auth-field">
        <span>Full name</span>
        <input
          className="modal-input"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          maxLength={60}
        />
      </label>

      {msg && <p className={msg === 'Profile saved' || msg === 'Profile picture updated' ? 'auth-info' : 'auth-error'}>{msg}</p>}
    </ModalShell>
  );
}

function ShareModal({ note }) {
  const { actions } = useNotes();
  const [copied, setCopied] = useState(null);

  const stripHtml = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const toMarkdown = (html) => {
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<u[^>]*>(.*?)<\/u>/gi, '__${1}__')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '---\n')
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const copy = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      actions.showToast(`${type} copied to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      actions.showToast('Failed to copy');
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title || 'Untitled', text: stripHtml(note.content) });
      } catch {}
    }
  };

  const titleHtml = note.title || 'Untitled';
  const contentHtml = note.content || '';
  const allHtml = `<h1>${titleHtml}</h1>${contentHtml}`;

  return (
    <ModalShell
      icon="fa-solid fa-share-nodes"
      title="Share Note"
      subtitle="Copy or share your note"
      onClose={() => actions.closeModal()}
      footer={<button className="modal-btn" onClick={() => actions.closeModal()}>Done</button>}
    >
      <div className="share-list">
        <button className="share-item" onClick={() => copy(allHtml, 'Rich Text')}>
          <i className="fa-solid fa-file-word"></i>
          <div>
            <div className="share-item-title">Copy as Rich Text</div>
            <div className="share-item-desc">Paste into Word, Google Docs, email</div>
          </div>
          {copied === 'Rich Text' && <i className="fa-solid fa-check share-check"></i>}
        </button>
        <button className="share-item" onClick={() => copy(stripHtml(allHtml), 'Plain Text')}>
          <i className="fa-solid fa-file-lines"></i>
          <div>
            <div className="share-item-title">Copy as Plain Text</div>
            <div className="share-item-desc">No formatting, just the text</div>
          </div>
          {copied === 'Plain Text' && <i className="fa-solid fa-check share-check"></i>}
        </button>
        <button className="share-item" onClick={() => copy(allHtml, 'HTML')}>
          <i className="fa-solid fa-code"></i>
          <div>
            <div className="share-item-title">Copy as HTML</div>
            <div className="share-item-desc">Raw HTML for web embedding</div>
          </div>
          {copied === 'HTML' && <i className="fa-solid fa-check share-check"></i>}
        </button>
        <button className="share-item" onClick={() => copy(toMarkdown(allHtml), 'Markdown')}>
          <i className="fa-brands fa-markdown"></i>
          <div>
            <div className="share-item-title">Copy as Markdown</div>
            <div className="share-item-desc">For GitHub, Notion, Obsidian</div>
          </div>
          {copied === 'Markdown' && <i className="fa-solid fa-check share-check"></i>}
        </button>
        {'share' in navigator && (
          <button className="share-item" onClick={shareNative}>
            <i className="fa-solid fa-paper-plane"></i>
            <div>
              <div className="share-item-title">Share via...</div>
              <div className="share-item-desc">Use your device's share menu</div>
            </div>
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function VersionHistoryModal({ noteId }) {
  const { state, actions } = useNotes();
  const versions = state.versions[noteId] || [];
  const [preview, setPreview] = useState(null);

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const stripHtml = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  return (
    <ModalShell
      icon="fa-solid fa-clock-rotate-left"
      title="Version History"
      subtitle={`${versions.length} version${versions.length !== 1 ? 's' : ''} saved`}
      onClose={() => actions.closeModal()}
      footer={<button className="modal-btn" onClick={() => actions.closeModal()}>Close</button>}
    >
      {versions.length === 0 ? (
        <p style={{ color: 'var(--text)', opacity: 0.6, textAlign: 'center', padding: '16px 0' }}>No versions saved yet. Versions are saved automatically when notes sync to the cloud.</p>
      ) : (
        <div className="version-list">
          {versions.map((v, i) => (
            <div key={i} className="version-item" onClick={() => setPreview(preview === i ? null : i)}>
              <div className="version-meta">
                <span className="version-time">{formatTime(v.savedAt)}</span>
                <span className="version-number">v{versions.length - i}</span>
              </div>
              <div className="version-title">{v.title || 'Untitled'}</div>
              {preview === i && (
                <div className="version-preview">
                  <p className="version-preview-text">{stripHtml(v.content).slice(0, 300) || 'Empty note'}</p>
                  <button className="modal-btn" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); actions.restoreVersion(noteId, v); actions.closeModal(); }}>
                    <i className="fa-solid fa-rotate-left" style={{ marginRight: 6 }}></i> Restore this version
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

export default function Modals() {
  const { state } = useNotes();
  const { modal, notes, activeId } = state;
  const note = notes.find((n) => n.id === activeId);

  if (modal === 'new') return <NewNoteModal />;
  if (modal === 'category') return note ? <CategoryModal note={note} /> : null;
  if (modal === 'tag') return note ? <TagModal note={note} /> : null;
  if (modal === 'delete') return <DeleteModal />;
  if (modal === 'archive') return note ? <ArchiveModal note={note} /> : null;
  if (modal === 'profile') return <ProfileModal />;
  if (modal === 'versions') return note ? <VersionHistoryModal noteId={note.id} /> : null;
  if (modal === 'share') return note ? <ShareModal note={note} /> : null;
  return null;
}
