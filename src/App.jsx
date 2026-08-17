import { Component, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Modals from './components/Modals';
import Toast from './components/Toast';
import Auth from './components/Auth';
import Loading from './components/Loading';
import AuthShell from './components/auth/AuthShell';
import { useNotes } from './store';

class HeaderBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return (
        <header>
          <div className="header-left">
            <div className="logo">
              <i className="fa-solid fa-pen-nib"></i>
              Note<span>Flow</span>
            </div>
          </div>
        </header>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { state, actions } = useNotes();

  useEffect(() => {
    if (!('ontouchstart' in window)) return;
    let timer = null;
    const show = (e) => {
      const el = e.target.closest('[data-tooltip]');
      if (!el) return;
      clearTimeout(timer);
      document.querySelectorAll('.tooltip-show').forEach((n) => n.classList.remove('tooltip-show'));
      el.classList.add('tooltip-show');
      const rect = el.getBoundingClientRect();
      const tip = el;
      tip.style.setProperty('--tip-x', rect.left + rect.width / 2 + 'px');
      tip.style.setProperty('--tip-y', rect.bottom + 8 + 'px');
      timer = setTimeout(() => el.classList.remove('tooltip-show'), 2000);
    };
    const hide = (e) => {
      if (!e.target.closest('[data-tooltip]')) {
        clearTimeout(timer);
        document.querySelectorAll('.tooltip-show').forEach((n) => n.classList.remove('tooltip-show'));
      }
    };
    document.addEventListener('touchstart', show, { passive: true });
    document.addEventListener('touchstart', hide, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', show);
      document.removeEventListener('touchstart', hide);
    };
  }, []);

  if (state.authLoading) {
    return (
      <AuthShell>
        <div className="auth-loader">
          <div className="auth-brand-mark">
            <img src="/favicon.svg" alt="" className="auth-brand-favicon" />
          </div>
          <span className="nf-spinner nf-spinner-lg" aria-hidden="true" />
        </div>
      </AuthShell>
    );
  }

  if (!state.user) {
    return (
      <>
        <Auth />
        <Toast />
      </>
    );
  }

  if (state.loading) {
    return (
      <>
        <Loading />
        <Toast />
      </>
    );
  }

  return (
    <>
      <HeaderBoundary>
        <Header />
      </HeaderBoundary>
      <div className="app-layout">
        <div className={`sidebar-backdrop${state.sidebarOpen ? ' open' : ''}`} onClick={() => actions.closeSidebar()} />
        <Sidebar />
        <Editor />
      </div>
      <Modals />
      <Toast />
    </>
  );
}
