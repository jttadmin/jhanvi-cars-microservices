import { useEffect, useState } from 'react';
import AuthModal from './components/AuthModal';
import CustomerDashboard from './components/CustomerDashboard';
import DriverDashboard from './components/DriverDashboard';
import { getMe, logout as clearSession } from './api/auth';
import { getToken, setSessionExpiredHandler } from './api/client';
import type { AuthUser } from './types';
import './App.css';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

  // Any 401 from any request logs the user out, wherever it happens.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  // Restore the session on load if a token is already stored.
  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch((err) => {
        console.error('Session restore failed:', err);
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  function handleLogout() {
    clearSession();
    setUser(null);
  }

  if (checkingSession) {
    return <div className="app-loading">Loading…</div>;
  }

  if (!user) {
    return (
      <>
        <CustomerDashboard
          onRequireAuth={() => setAuthOpen(true)}
        />
        {authOpen && (
          <AuthModal
            onAuthenticated={(authenticatedUser) => {
              setUser(authenticatedUser);
              setAuthOpen(false);
            }}
            onClose={() => setAuthOpen(false)}
          />
        )}
      </>
    );
  }

  if (user.role === 'CUSTOMER') {
    return (
      <CustomerDashboard
        user={user}
        onLogout={handleLogout}
        onUserUpdated={setUser}
      />
    );
  }

  if (user.role === 'DRIVER') {
    return <DriverDashboard user={user} onLogout={handleLogout} />;
  }

  // ADMIN — no dashboard built yet, but routing is ready for it.
  return (
    <div className="admin-placeholder">
      <p>Admin dashboard is coming soon.</p>
      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
