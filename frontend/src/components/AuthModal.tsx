import { useState, type FormEvent } from 'react';
import { login, register } from '../api/auth';
import { ApiError } from '../api/client';
import BrandMark from './BrandMark';
import type { AuthUser, Role } from '../types';

interface AuthModalProps {
  onAuthenticated: (user: AuthUser) => void;
  onClose?: () => void;
}

type Mode = 'login' | 'register';

export default function AuthModal({ onAuthenticated, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === 'login' ? await login({ email, password }) : await register({
          name,
          email,
          password,
          role,
          mobileNumber,
          licenseNumber: role === 'DRIVER' ? licenseNumber : undefined,
          vehicleNumber: role === 'DRIVER' ? vehicleNumber : undefined,
        });
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay">
      {onClose && (
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      )}
      <div className="auth-hero">
        <span className="brand-row auth-hero-brand">
          <BrandMark />
          <span className="brand">Jhanvi Cars</span>
        </span>
        <svg className="auth-hero-route" viewBox="0 0 320 180" fill="none" aria-hidden="true">
          <path
            d="M10 150 C 70 150, 90 60, 150 60 S 230 150, 300 40"
            stroke="var(--yellow)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1 14"
          />
          <circle cx="10" cy="150" r="6" fill="var(--teal)" />
          <circle cx="300" cy="40" r="6" fill="var(--paper)" />
        </svg>
        <p className="auth-hero-line">Auto. Bike. Sedan. SUV. Wherever you're headed, book it in seconds.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">{mode === 'login' ? 'Log in to book or drive.' : 'Book rides or start driving with Jhanvi Cars.'}</p>

        {mode === 'register' && (
          <>
            <label className="auth-field">
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>

            <label className="auth-field">
              Mobile number
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
              />
            </label>

            {role === 'DRIVER' && (
              <>
                <label className="auth-field">
                  License number
                  <input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    required
                  />
                </label>

                <label className="auth-field">
                  Vehicle number
                  <input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
          </>
        )}

        <label className="auth-field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className="auth-field">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>

        {mode === 'register' && (
          <div className="auth-role-toggle">
            <button type="button" className={role === 'CUSTOMER' ? 'active' : ''} onClick={() => setRole('CUSTOMER')}>
              I'm a customer
            </button>
            <button type="button" className={role === 'DRIVER' ? 'active' : ''} onClick={() => setRole('DRIVER')}>
              I'm a driver
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="book-button" disabled={loading}>
          {loading ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
