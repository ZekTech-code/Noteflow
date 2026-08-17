import AuthShell from './auth/AuthShell';

export default function Loading() {
  return (
    <AuthShell>
      <div className="loading-card">
        <div className="auth-brand-mark loading-logo">
          <img src="/favicon.svg" alt="" className="auth-brand-favicon" />
        </div>
        <h1 className="loading-title">NoteFlow</h1>
        <div className="loading-bar">
          <span />
        </div>
        <p className="loading-text">Loading your notes…</p>
      </div>
    </AuthShell>
  );
}
