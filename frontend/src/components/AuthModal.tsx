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
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      {onClose && (
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      )}

      <aside className="auth-hero">
        <span className="brand-row auth-hero-brand">
          <BrandMark inverted />
          <span className="brand">Jhanvi Cars</span>
        </span>

        <div className="auth-hero-copy">
          <h2 className="auth-hero-title">Your city, your ride.</h2>
          <p className="auth-hero-line">
            From quick auto hops to premium AC cars, book a Jhanvi ride in seconds.
          </p>
        </div>

        <div className="auth-vehicle-strip" aria-hidden="true">
          <img src="/vehicles/auto.svg" alt="" />
          <img src="/vehicles/economy.svg" alt="" />
          <img src="/vehicles/comfort.svg" alt="" />
          <img src="/vehicles/comfort-plus.svg" alt="" />
        </div>
      </aside>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-inner">
          <h1 id="auth-title" className="auth-title">
            {mode === 'login' ? 'Log in to Jhanvi Cars' : 'Create your account'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Log in to book a ride or start driving.'
              : 'Ride with Jhanvi Cars, or sign up to drive.'}
          </p>

          {mode === 'register' && (
            <div className="auth-role-toggle" role="tablist" aria-label="Account type">
              <button
                type="button"
                role="tab"
                aria-selected={role === 'CUSTOMER'}
                className={role === 'CUSTOMER' ? 'active' : ''}
                onClick={() => setRole('CUSTOMER')}
              >
                Ride
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={role === 'DRIVER'}
                className={role === 'DRIVER' ? 'active' : ''}
                onClick={() => setRole('DRIVER')}
              >
                Drive
              </button>
            </div>
          )}

        {mode === 'register' && (
          <>
            <label className="auth-field">
              <span>Full name</span>
              <input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>

            <label className="auth-field">
              <span>Mobile number</span>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                autoComplete="tel"
                required
              />
            </label>

            {role === 'DRIVER' && (
              <>
                <label className="auth-field">
                  <span>License number</span>
                  <input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Vehicle type</span>
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
                  <span>Vehicle model</span>
                  <input
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. Maruti Suzuki Dzire"
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>Vehicle number</span>
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

        <label className="auth-field">
          <span>{mode === 'login' ? 'Email or mobile number' : 'Email'}</span>
          <input
            type={mode === 'login' ? 'text' : 'email'}
            placeholder={mode === 'login' ? 'name@example.com or 98XXXXXXXX' : 'name@example.com'}
            value={mode === 'login' ? loginIdentifier : email}
            onChange={(e) =>
              mode === 'login'
                ? setLoginIdentifier(e.target.value)
                : setEmail(e.target.value)
            }
            autoComplete={mode === 'login' ? 'username' : 'email'}
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
          />
        </label>

        {mode === 'register' && (
          <label className="auth-field">
            <span>Confirm password</span>
            <input
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
        )}

        {error && <p className="error-text" role="alert">{error}</p>}

        <button type="submit" className="book-button auth-submit" disabled={loading}>
          {loading ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : mode === 'login' ? 'Continue' : 'Create account'}
        </button>

        <div className="auth-divider"><span>or</span></div>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
            setConfirmPassword('');
          }}
        >
          {mode === 'login' ? 'Create a new account' : 'I already have an account'}
        </button>
        </div>
      </form>
    </div>
  );
}
