import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotes, getFiltered } from '../store';
import { stripHtml } from '../utils';

const FILTER_CATS = [
  { key: 'all', label: 'All Notes', icon: 'fa-solid fa-layer-group' },
  { key: 'work', label: 'Work', icon: 'fa-solid fa-briefcase' },
  { key: 'personal', label: 'Personal', icon: 'fa-solid fa-user' },
  { key: 'ideas', label: 'Ideas', icon: 'fa-solid fa-lightbulb' },
];

const LIBRARY_CATS = [
  { key: 'pinned', label: 'Pinned', icon: 'fa-solid fa-thumbtack' },
  { key: 'archived', label: 'Archived', icon: 'fa-solid fa-box-archive' },
];

function statusInfo(cloudEnabled, syncStatus) {
  if (!cloudEnabled) {
    return { text: 'Local storage', icon: 'fa-solid fa-hard-drive', cls: 'offline' };
  }
  if (syncStatus === 'synced') return { text: 'Cloud synced', icon: 'fa-solid fa-cloud', cls: 'synced' };
  if (syncStatus === 'syncing') return { text: 'Syncing…', icon: 'fa-solid fa-rotate fa-spin', cls: 'syncing' };
  if (syncStatus === 'error') return { text: 'Sync error', icon: 'fa-solid fa-triangle-exclamation', cls: 'error' };
  return { text: 'Offline', icon: 'fa-solid fa-circle', cls: 'offline' };
}

export default function Sidebar() {
  const { state, actions } = useNotes();
  const { notes, activeFilter, searchQuery, activeId, sidebarOpen, cloudEnabled, syncStatus } = state;
  const filtered = getFiltered(notes, activeFilter, searchQuery);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [unsavedModal, setUnsavedModal] = useState(false);

  const counts = {
    all: notes.filter((n) => !n.archived).length,
    work: notes.filter((n) => n.category === 'work' && !n.archived).length,
    personal: notes.filter((n) => n.category === 'personal' && !n.archived).length,
    ideas: notes.filter((n) => n.category === 'ideas' && !n.archived).length,
    pinned: notes.filter((n) => n.pinned && !n.archived).length,
    archived: notes.filter((n) => n.archived).length,
  };

  const status = statusInfo(cloudEnabled, syncStatus);

  return (
    <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
      <div className="sidebar-search">
        <div className="search-wrap">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Search notes…"
            value={searchQuery}
            onChange={(e) => actions.setSearch(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" data-tooltip="Clear search" aria-label="Clear search" onClick={() => actions.setSearch('')}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="cats-label">Filters</div>
        <div className="cat-list">
          {FILTER_CATS.map((c) => (
            <button
              key={c.key}
              className={`cat-btn${activeFilter === c.key ? ' active' : ''}`}
              onClick={() => actions.setFilter(c.key)}
            >
              <i className={c.icon}></i>
              <span className="cat-label">{c.label}</span>
              <span className="cat-count">{counts[c.key]}</span>
            </button>
          ))}
        </div>

        <div className="cats-label">Library</div>
        <div className="cat-list">
          {LIBRARY_CATS.map((c) => (
            <button
              key={c.key}
              className={`cat-btn${activeFilter === c.key ? ' active' : ''}`}
              onClick={() => actions.setFilter(c.key)}
            >
              <i className={c.icon}></i>
              <span className="cat-label">{c.label}</span>
              <span className="cat-count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="notes-section">
        <div className="notes-section-head">
          <span className="cats-label">Notes</span>
          <span className="notes-count">{filtered.length}</span>
        </div>
        <div className="notes-list-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <i className="fa-regular fa-folder-open"></i>
              <p>No notes found</p>
            </div>
          ) : (
            filtered.map((n, i) => (
              <div
                key={n.id}
                className={`note-list-item${n.id === activeId ? ' active' : ''}`}
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => actions.openNote(n.id)}
              >
                {n.pinned && <i className="fa-solid fa-thumbtack pin-dot"></i>}
                <div className="note-list-title">{stripHtml(n.title) || 'Untitled'}</div>
                <div className="note-list-preview">{stripHtml(n.content).slice(0, 60) || '—'}</div>
                <div className="note-list-meta">
                  <span className="note-list-date">
                    {new Date(n.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                  {n.tags.slice(0, 2).map((t) => (
                    <span key={t} className="note-tag">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <span className={`sidebar-status status-${status.cls}`}>
          <i className={status.icon}></i> {status.text}
        </span>
        <button className="sidebar-logout" onClick={() => (actions.hasUnsavedChanges() ? setUnsavedModal(true) : setLogoutConfirm(true))}>
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Log out
        </button>
      </div>

      {unsavedModal &&
        createPortal(
          <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setUnsavedModal(false); }}>
            <div className="modal auth-success-modal">
              <div className="auth-success-icon logout-icon">
                <i className="fa-solid fa-floppy-disk"></i>
              </div>
              <h3>Unsaved Changes</h3>
              <p>You have unsaved changes. Do you want to save them before logging out?</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setUnsavedModal(false)}>Cancel</button>
                <button className="btn btn-ghost" onClick={() => { setUnsavedModal(false); actions.logout({ discard: true }); }}>
                  No
                </button>
                <button className="btn btn-danger-solid" onClick={() => { setUnsavedModal(false); actions.logout(); }}>
                  Yes, Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {logoutConfirm &&
        createPortal(
          <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setLogoutConfirm(false); }}>
            <div className="modal auth-success-modal">
              <div className="auth-success-icon logout-icon">
                <i className="fa-solid fa-right-from-bracket"></i>
              </div>
              <h3>Log Out</h3>
              <p>Are you sure you want to log out of your account?</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setLogoutConfirm(false)}>No</button>
                <button className="btn btn-danger-solid" onClick={() => { setLogoutConfirm(false); actions.logout(); }}>
                  <i className="fa-solid fa-arrow-right-from-bracket"></i> Yes, Log out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </aside>
  );
}
