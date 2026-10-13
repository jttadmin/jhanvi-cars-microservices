import { useEffect, useState } from 'react';
import AuthModal from './components/AuthModal';
import CustomerDashboard from './components/CustomerDashboard';
import Footer from './components/Footer';
import DriverDashboard from './components/DriverDashboard';
import { getMe, logout as clearSession } from './api/auth';
import { getToken, setSessionExpiredHandler } from './api/client';
import type { AuthUser } from './types';
import './App.css';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const isAdminPath = window.location.pathname.replace(/\/+$/, '') === '/admin';

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

  if (isAdminPath) {
    if (user?.role === 'ADMIN') {
      return <AdminDashboard onLogout={handleLogout} />;
    }

    if (user) {
      return (
        <main className="admin-login-page">
          <section className="admin-login-card">
            <h1>Access denied</h1>
            <p>This account is not authorized to access the Admin workspace.</p>
            <button type="button" onClick={handleLogout}>Sign out</button>
            <button type="button" className="admin-login-back" onClick={() => { window.location.href = '/'; }}>
              Back to Jhanvi Cars
            </button>
          </section>
        </main>
      );
    }

    return (
      <AdminLogin
        onAuthenticated={(authenticatedUser) => {
          if (authenticatedUser.role === 'ADMIN') {
            setUser(authenticatedUser);
          } else {
            handleLogout();
          }
        }}
        onBack={() => { window.location.href = '/'; }}
      />
    );
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        {!user ? (
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
        ) : user.role === 'CUSTOMER' ? (
          <CustomerDashboard
            user={user}
            onLogout={handleLogout}
            onUserUpdated={setUser}
          />
        ) : user.role === 'DRIVER' ? (
          <DriverDashboard
            user={user}
            onLogout={handleLogout}
          />
        ) : (
          <AdminDashboard onLogout={handleLogout} />
        )}
      </main>

      <Footer />
    </div>
  );

}
