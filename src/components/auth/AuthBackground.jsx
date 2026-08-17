import { useState, useEffect, useRef } from 'react';

export const AUTH_VIDEO = {
  src: import.meta.env.VITE_AUTH_VIDEO_URL || 'https://assets.mixkit.co/videos/50128/50128-720.mp4',
  type: 'video/mp4',
  poster: import.meta.env.VITE_AUTH_VIDEO_POSTER || 'https://assets.mixkit.co/videos/50128/50128-thumb-720-0.jpg',
};

const WORD_COLUMNS = [
  ['Capture ideas', 'Organize notes', 'Review drafts', 'Plan clearly'],
  ['Focused writing', 'Private sync', 'Daily notes', 'Thoughtful work'],
];

const TYPE_TEXT = 'Writing, saving, reviewing, and organizing your best ideas securely...';
const TYPE_SPEED = 80;
const TYPE_PAUSE = 2500;
const TYPE_DELETE_SPEED = 30;

export default function AuthBackground() {
  const [failed, setFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const phaseRef = useRef('typing');
  const idxRef = useRef(0);

  useEffect(() => {
    let timer;
    const tick = () => {
      if (phaseRef.current === 'typing') {
        idxRef.current++;
        setTyped(TYPE_TEXT.slice(0, idxRef.current));
        if (idxRef.current >= TYPE_TEXT.length) {
          phaseRef.current = 'pause';
          timer = setTimeout(tick, TYPE_PAUSE);
          return;
        }
        timer = setTimeout(tick, TYPE_SPEED);
      } else if (phaseRef.current === 'pause') {
        phaseRef.current = 'deleting';
        timer = setTimeout(tick, TYPE_DELETE_SPEED);
      } else {
        idxRef.current--;
        setTyped(TYPE_TEXT.slice(0, idxRef.current));
        if (idxRef.current <= 0) {
          phaseRef.current = 'typing';
          timer = setTimeout(tick, 600);
          return;
        }
        timer = setTimeout(tick, TYPE_DELETE_SPEED);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="auth-backdrop" aria-hidden="true">
      {failed ? (
        <img className="auth-video" src={AUTH_VIDEO.poster} alt="" />
      ) : (
        <video
          className="auth-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={AUTH_VIDEO.poster}
          onError={() => setFailed(true)}
        >
          <source src={AUTH_VIDEO.src} type={AUTH_VIDEO.type} />
        </video>
      )}
      <div className="auth-overlay" />
      <div className="auth-vignette" />
      <div className="auth-word-field">
        {WORD_COLUMNS.map((words, columnIndex) => (
          <div className={`auth-word-column ${columnIndex === 0 ? 'left' : 'right'}`} key={columnIndex}>
            <div className="auth-word-track">
              {[...words, ...words].map((word, wordIndex) => (
                <span key={`${word}-${wordIndex}`}>{word}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="auth-mobile-copy">
        <p className="auth-mobile-top-text">A focused workspace for clear notes, thoughtful drafts, daily plans, research highlights, meeting summaries, private reflections, organized ideas, and writing that stays easy to find.</p>
        <p className="auth-mobile-type-text"><span>{typed}<span className="type-caret">|</span></span></p>
      </div>
      <div className="auth-grain" />
    </div>
  );
}