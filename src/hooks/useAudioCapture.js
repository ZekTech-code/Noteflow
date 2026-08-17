import { useState, useRef, useCallback, useEffect } from 'react';

const SR = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

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

  onFinalRef.current = onFinalTranscript;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      destroyAll();
    };
  }, []);

  function destroyAll() {
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

  function startRec() {
    if (!shouldListenRef.current || pausedRef.current || !mountedRef.current) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      if (pausedRef.current || !mountedRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text && mountedRef.current && onFinalRef.current) {
            onFinalRef.current(text);
          }
        }
      }
    };

    rec.onerror = (e) => {
      if (!mountedRef.current) return;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'network' || e.error === 'audio-capture') {
        startRec();
        return;
      }
      setError(e.error);
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      if (shouldListenRef.current && !pausedRef.current) {
        startRec();
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
    shouldListenRef.current = true;
    pausedRef.current = false;
    startRec();
    if (mountedRef.current) {
      setListening(true);
      setPaused(false);
    }
  }, []);

  const pause = useCallback(() => {
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
    setError(null);
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
