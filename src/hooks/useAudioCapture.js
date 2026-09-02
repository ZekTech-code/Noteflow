import { useState, useRef, useCallback, useEffect } from 'react';

const SR = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

// Cap automatic restarts so a failing connection can't spin the CPU or spam
// permission prompts. "network" / "audio-capture" are transient — retried with
// backoff. Everything else (not-allowed, service-not-allowed, language-not-supported)
// is fatal and must stop the recognizer.
const MAX_RESTARTS = 3;
const RESTART_BASE_DELAY = 800;

export function useAudioCapture({ onFinalTranscript, language = 'en-US' } = {}) {
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interim, setInterim] = useState('');
  const [supported] = useState(() => !!SR);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const recRef = useRef(null);
  const mountedRef = useRef(true);
  const onFinalRef = useRef(onFinalTranscript);
  const shouldListenRef = useRef(false);
  const pausedRef = useRef(false);
  const restartsRef = useRef(0);
  const restartTimerRef = useRef(null);

  onFinalRef.current = onFinalTranscript;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      destroyAll();
    };
  }, []);

  function clearRestartTimer() {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function destroyAll() {
    clearRestartTimer();
    shouldListenRef.current = false;
    pausedRef.current = false;
    const rec = recRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch {}
      recRef.current = null;
    }
  }

  function scheduleRestart() {
    if (restartsRef.current >= MAX_RESTARTS) {
      shouldListenRef.current = false;
      pausedRef.current = false;
      if (mountedRef.current) {
        setListening(false);
        setPaused(false);
        setError('network');
      }
      return;
    }
    restartsRef.current += 1;
    const delay = RESTART_BASE_DELAY * 2 ** (restartsRef.current - 1);
    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (mountedRef.current && shouldListenRef.current && !pausedRef.current) {
        startRec();
      }
    }, delay);
  }

  function startRec() {
    if (!shouldListenRef.current || pausedRef.current || !mountedRef.current) return;

    let rec;
    try {
      rec = new SR();
    } catch {
      setError('not-supported');
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      if (pausedRef.current || !mountedRef.current) return;
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0] && event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += chunk;
        } else {
          interimText += chunk;
        }
      }
      if (finalText && mountedRef.current && onFinalRef.current) {
        onFinalRef.current(finalText.trim());
        restartsRef.current = 0;
      }
      if (mountedRef.current) {
        setInterim(interimText);
      }
    };

    rec.onerror = (e) => {
      if (!mountedRef.current) return;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'network' || e.error === 'audio-capture') {
        scheduleRestart();
        return;
      }
      // Fatal: permission denied / service unavailable / wrong language.
      shouldListenRef.current = false;
      pausedRef.current = false;
      setError(e.error === 'not-allowed' ? 'not-allowed' : e.error);
      setListening(false);
      setPaused(false);
      if (e.error === 'not-allowed') {
        try { rec.abort(); } catch {}
      }
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      if (shouldListenRef.current && !pausedRef.current) {
        scheduleRestart();
      } else if (!pausedRef.current) {
        setListening(false);
      }
    };

    recRef.current = rec;
    try { rec.start(); } catch {}
  }

  const start = useCallback(() => {
    if (!SR) { setError('not-supported'); return; }
    destroyAll();
    setError(null);
    setLoading(false);
    restartsRef.current = 0;
    shouldListenRef.current = true;
    pausedRef.current = false;
    startRec();
    if (mountedRef.current) {
      setListening(true);
      setPaused(false);
      setInterim('');
    }
  }, []);

  const pause = useCallback(() => {
    clearRestartTimer();
    pausedRef.current = true;
    if (mountedRef.current) setPaused(true);
    const rec = recRef.current;
    if (rec) {
      rec.onend = null;
      try { rec.stop(); } catch {}
      recRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (!SR) return;
    clearRestartTimer();
    setError(null);
    restartsRef.current = 0;
    shouldListenRef.current = true;
    pausedRef.current = false;
    const old = recRef.current;
    if (old) {
      old.onresult = null;
      old.onerror = null;
      old.onend = null;
      try { old.abort(); } catch {}
      recRef.current = null;
    }
    startRec();
    if (mountedRef.current) {
      setPaused(false);
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    destroyAll();
    if (mountedRef.current) {
      setListening(false);
      setPaused(false);
      setInterim('');
    }
  }, []);

  return { listening, paused, interim, supported, error, loading, start, pause, resume, stop };
}