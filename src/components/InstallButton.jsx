import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIos = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
const isAndroid = /android/i.test(ua);
const isEdge = /edg\//i.test(ua);
const isFirefox = /firefox/i.test(ua);
const isSafariDesktop = /safari/i.test(ua) && !/chrome|crios/i.test(ua);
const isChrome = /chrome|crios/i.test(ua) && !isEdge;

function getDiagnostics() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      warning: true,
      title: "Can't install from this address",
      steps: [
        'Browsers only allow installation over HTTPS (or localhost).',
        `You're viewing this app over a non-secure address: ${window.location.hostname}.`,
        'Open the app at http://localhost on this device (or deploy it to an HTTPS site), then try again.',
      ],
    };
  }
  if (isIos) {
    return {
      title: 'Install NoteFlow',
      steps: [
        'Tap the Share button (box with up arrow) at the bottom of Safari.',
        'Scroll down and tap "Add to Home Screen".',
        'Tap "Add" — an app icon appears on your home screen.',
      ],
    };
  }
  if (isAndroid) {
    return {
      title: 'Install NoteFlow',
      steps: [
        'Tap the ⋮ menu (three dots, top-right).',
        'Tap "Install app" or "Add to Home screen".',
        'Confirm — an app icon appears on your home screen.',
      ],
    };
  }
  if (isFirefox) {
    return {
      title: 'Install NoteFlow',
      steps: [
        'Open the Firefox (☰) menu.',
        'Choose "Install NoteFlow" or "Web Apps → Install".',
        'Confirm — the app is installed and opens in its own window.',
      ],
    };
  }
  if (isEdge) {
    return {
      title: 'Install NoteFlow',
      steps: [
        'Click the ⋮ menu (top-right).',
        'Choose "Apps → Install NoteFlow".',
        'Confirm — it\'s added to your apps. Pin it to taskbar from the Start menu.',
      ],
    };
  }
  if (isSafariDesktop) {
    return {
      title: 'Install NoteFlow',
      steps: [
        'In Safari, go to File → Add to Dock.',
        'Confirm — NoteFlow appears in your Dock.',
      ],
    };
  }
  if (isChrome) {
    return {
      title: 'Install NoteFlow',
      steps: [
        'Click the ⋮ menu (top-right).',
        'Click "Install NoteFlow" or "Cast, save, and share" → "Install page as app".',
        'Confirm — NoteFlow opens in its own window.',
      ],
    };
  }
  return {
    title: 'Install NoteFlow',
    steps: [
      'Click the ⋮ menu in your browser toolbar.',
      'Look for "Install app", "Install page as app", or "Add to Home screen".',
      'If nothing appears, try refreshing the page first.',
    ],
  };
}

function InstallModal({ onClose, nativePrompt }) {
  const diag = getDiagnostics();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleNativeInstall = useCallback(async () => {
    if (nativePrompt) {
      nativePrompt.prompt();
      const { outcome } = await nativePrompt.userChoice;
      if (outcome === 'accepted') {
        onClose();
      }
    }
  }, [nativePrompt, onClose]);

  return createPortal(
    <div className="install-modal-overlay" onMouseDown={(e) => e.preventDefault()}>
      <div className="modal install-help">
        <h3>
          <i
            className={diag.warning ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-download'}
            style={{ color: diag.warning ? 'var(--danger)' : 'var(--accent)', marginRight: 8 }}
          ></i>
          {diag.title}
        </h3>
        {diag.warning && <p className="install-warning">Installation requires a secure connection.</p>}
        {nativePrompt && (
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 16 }}
            onClick={handleNativeInstall}
          >
            <i className="fa-solid fa-download"></i> Install Now
          </button>
        )}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {nativePrompt
            ? 'Or follow these manual steps:'
            : 'Your browser hasn\'t offered automatic install yet. Follow these steps:'}
        </p>
        <ol className="install-steps">{diag.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <div className="modal-footer">
          {isIos ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Got it</button>
              <button className="btn btn-primary" onClick={onClose}>
                <i className="fa-solid fa-circle-check"></i> Added to Home Screen
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>Got it</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function InstallButton() {
  const [showHelp, setShowHelp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleClick = useCallback(() => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(({ outcome }) => {
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    } else {
      setShowHelp(true);
    }
  }, [deferredPrompt]);

  return (
    <>
      <button
        className="btn btn-ghost install-btn"
        onClick={handleClick}
        data-tooltip="Install NoteFlow on this device"
        aria-label="Install NoteFlow on this device"
      >
        <i className="fa-solid fa-download"></i>
        <span className="install-label">Install</span>
      </button>
      {showHelp && (
        <InstallModal
          onClose={() => setShowHelp(false)}
          nativePrompt={deferredPrompt}
        />
      )}
    </>
  );
}
