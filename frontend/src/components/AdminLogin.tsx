import { useState, type FormEvent } from 'react';
import { login } from '../api/auth';
import { ApiError, clearToken } from '../api/client';
import type { AuthUser } from '../types';

interface AdminLoginProps {
  onAuthenticated: (user: AuthUser) => void;
  onBack: () => void;
}

export default function AdminLogin({
  onAuthenticated,
  onBack,
}: AdminLoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const user = await login({ identifier, password });

      if (user.role !== 'ADMIN') {
        clearToken();
        setError('Access denied. An authorized admin account is required.');
        return;
      }

      onAuthenticated(user);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to log in. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-mark">J</div>
        <p className="admin-eyebrow">JHANVI CARS</p>
        <h1>Admin sign in</h1>
        <p className="admin-login-description">
          Sign in with your authorized administrator account.
        </p>

        {error && <p className="admin-login-error" role="alert">{error}</p>}

        <label>
          Email or mobile number
          <input
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in to Admin'}
        </button>

        <button type="button" className="admin-login-back" onClick={onBack}>
          Back to Jhanvi Cars
        </button>
      </form>
    </main>
  );
}
