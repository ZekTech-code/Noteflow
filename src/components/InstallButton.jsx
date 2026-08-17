import { useEffect, useState } from 'react';
import { useNotes } from '../store';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIos = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
const isAndroid = /android/i.test(ua);
const isEdge = /edg\//i.test(ua);
const isFirefox = /firefox/i.test(ua);
const isSafariDesktop = /safari/i.test(ua) && !/chrome|crios/i.test(ua);

function getDiagnostics() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      warning: true,
      title: "Can't install from this address",
      steps: [
        <>
          Browsers only allow installation over <strong>HTTPS</strong> (or <strong>localhost</strong>).
        </>,
        <>
          You're viewing this app over a non-secure address: <code>{window.location.hostname}</code>.
        </>,
        <>
          Open the app at <strong>http://localhost</strong> on this device (or deploy it to an <strong>HTTPS</strong>{' '}
          site), then press Install again — the browser will show its install dialog and create the app icon.
        </>,
      ],
    };
  }
  if (isIos) {
    return {
      title: 'Install NoteFlow',
      steps: [
        <>
          Tap the <strong>Share</strong> button <i className="fa-solid fa-square-arrow-up"></i> in Safari.
        </>,
        <>
          Choose <strong>Add to Home Screen</strong>.
        </>,
        <>
          Tap <strong>Add</strong> — an app icon appears on your home screen.
        </>,
      ],
    };
  }
  if (isAndroid) {
    return {
      title: 'Install NoteFlow',
      steps: [
        <>
          Open the browser menu <strong>(⋮)</strong> at the top.
        </>,
        <>
          Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </>,
        <>
          Confirm — an app icon appears on your home screen.
        </>,
      ],
    };
  }
  if (isFirefox) {
    return {
      title: 'Install NoteFlow',
      steps: [
        <>
          Open the Firefox <strong>(☰)</strong> menu.
        </>,
        <>
          Choose <strong>Install NoteFlow</strong> (or <strong>Web Apps → Install</strong>).
        </>,
        <>
          Confirm — the app is installed and opens in its own window.
        </>,
      ],
    };
  }
  if (isEdge) {
    return {
      title: 'Install NoteFlow',
      steps: [
        <>
          Click the <strong>(⋮)</strong> menu at the top-right of Edge.
        </>,
        <>
          Choose <strong>Apps → Install NoteFlow</strong>.
        </>,
        <>
          Confirm — it's added to your apps. Right-click it in Start to <strong>Pin to taskbar</strong> or{' '}
          <strong>More → Pin to taskbar</strong>.
        </>,
      ],
    };
  }
  if (isSafariDesktop) {
    return {
      title: 'Install NoteFlow',
      steps: [
        <>
          In Safari, go to <strong>File → Add to Dock</strong>.
        </>,
        <>
          Confirm — NoteFlow appears in your Dock.
        </>,
      ],
    };
  }
  return {
    title: 'Install NoteFlow',
    steps: [
      <>
        Your browser hasn't offered its install dialog for this page yet.
      </>,
      <>
        Click the <strong>Install</strong> icon <i className="fa-solid fa-download"></i> in the address bar, or the{' '}
        <strong>(⋮)</strong> menu → <strong>Install NoteFlow</strong>.
      </>,
      <>
        If nothing appears, <strong>refresh the page once</strong> and click Install again.
      </>,
    ],
  };
}

export default function InstallButton() {
  const { actions } = useNotes();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const showInstalledToast = () => {
    actions.showToast(
      isAndroid
        ? 'Installed! Open NoteFlow from your home screen.'
        : isIos
          ? 'Installed! Open NoteFlow from your home screen.'
          : 'Installed! Find NoteFlow in your Start menu.',
    );
  };

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
      showInstalledToast();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      setInstalled(true);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (installed) return null;

  const install = async () => {
    if (installPrompt) {
      setShowHelp(false);
      try {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        setInstallPrompt(null);
        if (choice && choice.outcome === 'accepted') {
          setInstalled(true);
          showInstalledToast();
        }
      } catch {
        setInstallPrompt(null);
      }
      return;
    }
    setShowHelp(true);
  };

  const diag = showHelp ? getDiagnostics() : null;

  return (
    <>
      <button className="btn btn-ghost install-btn" onClick={install} data-tooltip="Install NoteFlow on this device" aria-label="Install NoteFlow on this device">
        <i className="fa-solid fa-download"></i>
        <span className="install-label">Install</span>
      </button>
      {diag && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setShowHelp(false)}>
          <div className="modal install-help">
            <h3>
              <i
                className={diag.warning ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-download'}
                style={{ color: diag.warning ? 'var(--danger)' : 'var(--accent)', marginRight: 8 }}
              ></i>
              {diag.title}
            </h3>
            {diag.warning && <p className="install-warning">Installation requires a secure connection.</p>}
            <ol className="install-steps">{diag.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            <div className="modal-footer">
              {isIos ? (
                <>
                  <button className="btn btn-ghost" onClick={() => setShowHelp(false)}>
                    Got it
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowHelp(false);
                      setInstalled(true);
                      showInstalledToast();
                    }}
                  >
                    <i className="fa-solid fa-circle-check"></i> Added to Home Screen
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowHelp(false)}>
                  Got it
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
