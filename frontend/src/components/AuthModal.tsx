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
  const [vehicleType, setVehicleType] = useState<
    'AUTO' | 'ECONOMY' | 'COMFORT' | 'COMFORT_PLUS'
  >('ECONOMY');
  const [vehicleModel, setVehicleModel] = useState('');
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const user =
        mode === 'login'
          ? await login({ identifier: loginIdentifier, password })
          : await register({
              name,
              email,
              password,
              role,
              mobileNumber,
              licenseNumber: role === 'DRIVER' ? licenseNumber : undefined,
              vehicleNumber: role === 'DRIVER' ? vehicleNumber : undefined,
              vehicleType: role === 'DRIVER' ? vehicleType : undefined,
              vehicleModel: role === 'DRIVER' ? vehicleModel : undefined,
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
        <div className="auth-hero-copy">
          <h2 className="auth-hero-title"><span className="hero-title-main">Every Ride</span><span className="hero-title-accent">Takes You Further</span></h2>
        </div>

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
        <div className="auth-hero-city" aria-hidden="true">
        <div className="city-building city-building-1"></div>
        <div className="city-building city-building-2"></div>
        <div className="city-building city-building-3"></div>
        <div className="city-building city-building-4"></div>
      </div>

      <div className="auth-hero-car" aria-hidden="true">
        <div className="car-window"></div>
        <div className="car-body"></div>
        <div className="car-wheel car-wheel-left"></div>
        <div className="car-wheel car-wheel-right"></div>
        <div className="car-light"></div>
      </div>

      <p className="auth-hero-line">Auto. Sedan. SUV. Wherever you’re headed, book it in seconds.</p>
      <div className="auth-vehicle-types" aria-label="Vehicle types">
        <div className="auth-vehicle-card">
          <span className="vehicle-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M10 29h28v7H10z"/>
              <path d="M14 29l4-11h12l4 11"/>
              <circle cx="16" cy="38" r="4"/>
              <circle cx="32" cy="38" r="4"/>
              <path d="M20 22h8"/>
            </svg>
          </span>
          <strong>Auto</strong>
        </div>

        <div className="auth-vehicle-card">
          <span className="vehicle-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M8 31h32v6H8z"/>
              <path d="M13 31l5-12h12l6 12"/>
              <path d="M20 21h8"/>
              <circle cx="15" cy="38" r="4"/>
              <circle cx="33" cy="38" r="4"/>
            </svg>
          </span>
          <strong>Sedan</strong>
        </div>

        <div className="auth-vehicle-card">
          <span className="vehicle-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M7 31h34v7H7z"/>
              <path d="M11 31l5-13h16l7 13"/>
              <path d="M19 20h10"/>
              <circle cx="15" cy="39" r="4"/>
              <circle cx="34" cy="39" r="4"/>
            </svg>
          </span>
          <strong>SUV</strong>
        </div>
      </div>

      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">{mode === 'login' ? 'Log in to book or drive.' : 'Start driving with Jhanvi Cars.'}</p>

        {mode === 'register' && (
          <>
            <label className="auth-field auth-field-icon">
              <span className="field-icon" aria-hidden="true">♙</span>
              <input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="auth-field auth-field-icon">
              <span className="field-icon" aria-hidden="true">☎</span>
              <input
                type="tel"
                placeholder="Mobile number"
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
                  Vehicle type
                  <select
                    value={vehicleType}
                    onChange={(e) =>
                      setVehicleType(
                        e.target.value as
                          | 'AUTO'
                          | 'ECONOMY'
                          | 'COMFORT'
                          | 'COMFORT_PLUS',
                      )
                    }
                    required
                  >
                    <option value="AUTO">Auto</option>
                    <option value="ECONOMY">Economy</option>
                    <option value="COMFORT">Comfort</option>
                    <option value="COMFORT_PLUS">Comfort Plus</option>
                  </select>
                </label>

                <label className="auth-field">
                  Vehicle model
                  <input
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. Maruti Suzuki Dzire"
                    required
                  />
                </label>

                <label className="auth-field">
                  Vehicle number
                  <input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. KA01AB1234"
                    required
                  />
                </label>
              </>
            )}
          </>
        )}

        <label className="auth-field auth-field-icon">
          <span className="field-icon" aria-hidden="true">✉</span>
          <input
            type={mode === 'login' ? 'text' : 'email'}
            placeholder={mode === 'login' ? 'Email or mobile number' : 'Email'}
            value={mode === 'login' ? loginIdentifier : email}
            onChange={(e) =>
              mode === 'login'
                ? setLoginIdentifier(e.target.value)
                : setEmail(e.target.value)
            }
            required
          />
        </label>

        <label className="auth-field auth-field-icon">
          <span className="field-icon" aria-hidden="true">🔒</span>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {mode === 'register' && (
          <label className="auth-field auth-field-icon">
            <span className="field-icon" aria-hidden="true">🔒</span>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
        )}

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
	    setConfirmPassword('');
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
