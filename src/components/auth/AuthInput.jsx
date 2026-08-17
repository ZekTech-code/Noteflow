import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function AuthInput({
  id,
  label,
  type = 'text',
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  maxLength,
  error,
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && show ? 'text' : type;

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-row">
        {Icon && <Icon aria-hidden="true" className="auth-input-icon" />}
        <input
          id={id}
          className={`auth-input${isPassword ? ' has-toggle' : ''}`}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-eye"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <span id={`${id}-error`} className="auth-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
