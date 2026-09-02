import { useCallback, useEffect } from 'react';
import InstallButton from './InstallButton';
import { useNotes } from '../store';
import { useAudioCapture } from '../hooks/useAudioCapture';

export default function Header() {
  const { state, actions } = useNotes();
  const isDark = state.theme === 'dark';
  const meta = (state.user && state.user.user_metadata) || {};
  const avatarUrl = meta.avatar_url || '';
  const initial = (meta.full_name || (state.user && state.user.email) || 'U').charAt(0).toUpperCase();

  const onFinalTranscript = useCallback((text) => {
    actions.setTranscriptPending(text);
  }, [actions]);

  const {
    listening,
    paused,
    interim,
    supported,
    error,
    loading,
    start,
    pause,
    resume,
    stop,
  } = useAudioCapture({
    onFinalTranscript,
    language: state.speechLanguage || 'en-US',
  });

  const isRecording = listening || paused;

  useEffect(() => {
    if (error) {
      const friendly = {
        'not-allowed': 'Microphone permission was denied. Allow access in your browser and try again.',
        'not-supported': 'Speech recognition is not supported in this browser. Use Chrome or Edge.',
        network: 'Speech service is unavailable. Check your connection and try again.',
      }[error] || ('Mic error: ' + error);
      actions.showToast(friendly);
    }
  }, [error]);

  const handleMicClick = () => {
    if (!supported) {
      actions.showToast('Audio capture not supported. Use Chrome or Edge.');
      return;
    }
    if (loading) return;
    if (!isRecording) {
      start();
    } else if (listening && !paused) {
      pause();
    } else if (paused) {
      resume();
    }
  };

  const handleStop = () => {
    stop();
  };

  const micClass = `btn btn-ghost btn-icon header-mic${listening && !paused ? ' mic-active' : ''}${paused ? ' mic-paused' : ''}${loading ? ' mic-loading' : ''}`;

  return (
    <header>
      <div className="header-left">
        <button className="btn btn-ghost btn-icon header-menu" id="menuToggle" data-tooltip="Toggle Sidebar" aria-label="Toggle Sidebar" onClick={() => actions.toggleSidebar()}>
          <i className={state.sidebarOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
        </button>
        <div className="logo">
          <img src="/favicon.svg" alt="NoteFlow" className="header-logo-icon" />
        </div>
      </div>
      <div className="header-actions">
        <button
          className={micClass}
          data-tooltip={loading ? 'Loading…' : isRecording ? 'Pause' : 'Start Recording'}
          aria-label="Toggle Recording"
          onClick={handleMicClick}
          disabled={loading}
        >
          <i className={loading ? 'fa-solid fa-spinner fa-spin' : listening && !paused ? 'fa-solid fa-pause' : 'fa-solid fa-microphone'}></i>
        </button>

        {isRecording && (
          <button
            className="btn btn-ghost btn-icon header-stop"
            data-tooltip="Stop & Save"
            aria-label="Stop Recording"
            onClick={handleStop}
          >
            <i className="fa-solid fa-stop"></i>
          </button>
        )}

        <InstallButton />
        <button className="btn btn-primary header-new" onClick={() => actions.openModal('new')}>
          <i className="fa-solid fa-plus"></i> <span className="new-note-label">New Note</span>
        </button>
        <button className="btn btn-ghost btn-icon header-theme" data-tooltip="Toggle Theme" aria-label="Toggle Theme" onClick={() => actions.setTheme(isDark ? 'light' : 'dark')}>
          <i className={isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
        </button>
        <button className="header-avatar" data-tooltip="Profile & Settings" aria-label="Profile & Settings" onClick={() => actions.openModal('profile')}>
          {avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span>{initial}</span>}
        </button>
      </div>
    </header>
  );
}
