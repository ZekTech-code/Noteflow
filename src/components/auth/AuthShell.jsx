import AuthBackground from './AuthBackground';

export default function AuthShell({ children }) {
  return (
    <main className="auth-screen">
      <AuthBackground />
      <div className="auth-shell">
        <div className="auth-panel">{children}</div>
      </div>
    </main>
  );
}