import { useRef, useState } from 'react';

export default function GoldButton({ children, onClick, busy = false, disabled = false, type = 'submit', className = '' }) {
  const [ripples, setRipples] = useState([]);
  const btnRef = useRef(null);

  function handleClick(e) {
    if (busy || disabled) return;
    const rect = btnRef.current.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const id = Date.now() + Math.random();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    setRipples((r) => [...r, { id, x, y, size }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
    if (onClick) onClick(e);
  }

  return (
    <button
      ref={btnRef}
      type={type}
      className={`auth-submit${className ? ` ${className}` : ''}`}
      disabled={disabled || busy}
      onClick={handleClick}
      aria-busy={busy}
    >
      <span className="auth-ripple-zone" aria-hidden="true">
        {ripples.map((rp) => (
          <span
            key={rp.id}
            className="auth-ripple"
            style={{ left: rp.x, top: rp.y, width: rp.size, height: rp.size }}
          />
        ))}
      </span>
      <span className="auth-submit-label">
        {busy && <span className="nf-spinner" aria-hidden="true" />}
        {children}
      </span>
    </button>
  );
}
