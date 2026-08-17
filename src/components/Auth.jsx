import { useState } from 'react';
import { Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNotes } from '../store';
import AuthShell from './auth/AuthShell';
import AuthInput from './auth/AuthInput';
import GoldButton from './auth/GoldButton';
import SuccessModal from './auth/SuccessModal';

const MODE_COPY = {
  login: {
    heading: 'Welcome back',
    lede: 'Sign in to continue writing, reviewing, and organizing your notes.',
    submit: 'Sign in',
  },
  signup: {
    heading: 'Create your account',
    lede: 'Start with a secure workspace for your notes, drafts, and ideas.',
    submit: 'Create account',
  },
  reset: {
    heading: 'Reset your password',
    lede: 'Enter your email and we will send a secure reset link.',
    submit: 'Send reset link',
  },
};

export default function Auth() {
  const { state, actions } = useNotes();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [errors, setErrors] = useState({ name: '', email: '', password: '' });
  const [errorTimer, setErrorTimer] = useState(null);
  const [signupOk, setSignupOk] = useState(false);

  const copy = MODE_COPY[mode];

  function clearErrors() {
    setErrors({ name: '', email: '', password: '' });
    setError('');
    setInfo('');
  }

  function showErrors(next) {
    setErrors(next);
    setErrorTimer((timer) => {
      if (timer) clearTimeout(timer);
      return setTimeout(() => setErrors({ name: '', email: '', password: '' }), 4000);
    });
  }

  function validate() {
    const next = { name: '', email: '', password: '' };
    if (mode === 'signup') {
      const cleanName = name.trim();
      if (!cleanName) {
        next.name = 'Full name is required';
      } else if (cleanName.length < 2) {
        next.name = 'Name must be at least 2 characters';
      }
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      next.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      next.email = 'Enter a valid email address';
    }
    if (mode !== 'reset') {
      if (!password) {
        next.password = 'Password is required';
      } else if (mode === 'signup' && password.length < 6) {
        next.password = 'Password must be at least 6 characters';
      }
    }
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    const next = validate();
    if (next.name || next.email || next.password) {
      showErrors(next);
      return;
    }
    setBusy(true);
    const res =
      mode === 'login'
        ? await actions.login(email, password)
        : mode === 'signup'
          ? await actions.signup(email, password, name.trim())
          : await actions.resetPassword(email);
    setBusy(false);
    if (res.ok) {
      if (mode === 'signup') {
        setSignupOk(true);
        return;
      }
      if (mode === 'reset') {
        setInfo(res.message || 'Reset link sent. Check your email.');
        setMode('login');
        return;
      }
    } else {
      setError(res.error);
    }
  }

  function switchMode(next) {
    setMode(next);
    clearErrors();
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <header className="auth-brand">
          <div className="auth-brand-mark" aria-hidden="true">
            <img src="/favicon.svg" alt="" className="auth-brand-favicon" />
          </div>
          <h1 className="auth-brand-name" style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
            Note<em>Flow</em>
          </h1>
        </header>

        <div className="auth-heading">
          <h2>{copy.heading}</h2>
          <p>{copy.lede}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <AuthInput
              id="auth-name"
              label="Full name"
              icon={User}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((errs) => ({ ...errs, name: '' }));
              }}
              placeholder="Your name"
              maxLength={60}
              autoComplete="name"
              error={errors.name}
            />
          )}

          <AuthInput
            id="auth-email"
            label="Email address"
            type="email"
            icon={Mail}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((errs) => ({ ...errs, email: '' }));
            }}
            placeholder="you@example.com"
            autoComplete="email"
            error={errors.email}
          />

          {mode !== 'reset' && (
            <AuthInput
              id="auth-password"
              label="Password"
              type="password"
              icon={Lock}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((errs) => ({ ...errs, password: '' }));
              }}
              placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? 1 : 6}
              error={errors.password}
            />
          )}

          {error && (
            <div className="auth-alert error" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="auth-alert success" role="status">
              <CheckCircle2 aria-hidden="true" />
              <span>{info}</span>
            </div>
          )}

          <GoldButton busy={busy}>{copy.submit}</GoldButton>
        </form>

        {mode === 'login' && (
          <p className="auth-switch">
            <button type="button" className="auth-link" onClick={() => switchMode('reset')}>
              Forgot your password?
            </button>
          </p>
        )}

        {mode === 'login' && <div className="auth-divider">New to NoteFlow</div>}

        {mode === 'login' || mode === 'reset' ? (
          <p className="auth-switch">
            No account yet?{' '}
            <button type="button" onClick={() => switchMode('signup')}>
              Create one
            </button>
          </p>
        ) : (
          <p className="auth-switch">
            Already have an account?{' '}
            <button type="button" onClick={() => switchMode('login')}>
              Sign in
            </button>
          </p>
        )}

        {mode === 'reset' && (
          <p className="auth-switch">
            Remembered it?{' '}
            <button type="button" onClick={() => switchMode('login')}>
              Back to sign in
            </button>
          </p>
        )}

        <p className="auth-note">Your notes are encrypted and synced securely across devices.</p>
      </div>

      {signupOk && (
        <SuccessModal
          title="Account Created"
          message="Your account has been created successfully. Please sign in to continue."
          actionLabel="Continue"
          onAction={() => {
            setSignupOk(false);
            switchMode('login');
          }}
        />
      )}

      {state.pendingAuth && (
        <SuccessModal
          title="Welcome Back!"
          message="You have successfully signed in."
          actionLabel="Okay"
          onAction={actions.completeWelcome}
        />
      )}
    </AuthShell>
  );
}
