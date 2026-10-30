import { useEffect, useState } from 'react';
import { getMe } from '../api/auth';
import { setAvailability, setOnline, updateLocation, getDriverProfile, type DriverProfile } from '../api/drivers';
import { getBookings, acceptBooking, startBooking, completeBooking } from '../api/bookings';
import { ApiError } from '../api/client';
import { formatStatus } from '../utils/format';
import type { AuthUser, Booking } from '../types';
import BrandMark from './BrandMark';
import './DriverDashboard.css';

interface DriverDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function DriverDashboard({ user, onLogout }: DriverDashboardProps) {
  const [profile, setProfile] = useState<AuthUser>(user);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const [isAvailable, setIsAvailable] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<'assigned' | 'history'>('assigned');

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch(() => {
        /* keep the user prop passed in from login as a fallback */
      });

    getDriverProfile()
      .then((driver) => {
          setDriverProfile(driver);
          setIsAvailable(driver.isAvailable);
        })
      .catch((err) => {
        console.error('Driver profile request failed:', err);
        setProfileOpen(false);
      });
  }, []);

  function loadRides(showLoading = false) {
    if (showLoading) setRidesLoading(true);
    setRidesError(null);
    getBookings()
      .then(setBookings)
      .catch((err) => setRidesError(err instanceof ApiError ? err.message : 'Could not load your rides.'))
      .finally(() => setRidesLoading(false));
  }

  useEffect(() => { loadRides(true); }, []);

  // Keep the driver's ride list in sync with new customer bookings
  // and booking status changes.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadRides();
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  async function toggleAvailability() {
    if (availabilityLoading) return;

    const next = !isAvailable;
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    setLocationError(null);

    try {
      if (next) {
        // The backend requires the driver to be online before enabling availability.
        await setOnline(true);

        try {
          await setAvailability(true);
        } catch (err) {
          // Roll back the online state if availability could not be enabled.
          await setOnline(false).catch(() => undefined);
          throw err;
        }
      } else {
        // Going offline also clears availability in the backend.
        await setOnline(false);
      }

      setIsAvailable(next);
      setDriverProfile((current) =>
        current
          ? { ...current, isAvailable: next, isOnline: next }
          : current
      );

      if (!next) {
        setLocationTracking(false);
      }
    } catch (err) {
      setAvailabilityError(
        err instanceof ApiError
          ? err.message
          : 'Could not update your online status.'
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }

  useEffect(() => {
    if (!isAvailable) {
      setLocationTracking(false);
      return;
    }

    if (!navigator.geolocation) {
      setLocationError('Location services are not supported by this browser.');
      setLocationTracking(false);
      return;
    }

    let active = true;

    const sendLocation = (position: GeolocationPosition) => {
      if (!active) return;

      const { latitude, longitude } = position.coords;

      updateLocation(latitude, longitude)
        .then(() => {
          if (active) {
            setLocationTracking(true);
            setLocationError(null);
            setDriverProfile((current) =>
              current
                ? {
                    ...current,
                    latitude,
                    longitude,
                    lastLocationAt: new Date().toISOString(),
                  }
                : current
            );
          }
        })
        .catch((err) => {
          if (active) {
            setLocationError(
              err instanceof ApiError
                ? err.message
                : 'Could not update your location.'
            );
          }
        });
    };

    const handleLocationError = (error: GeolocationPositionError) => {
      if (!active) return;

      setLocationTracking(false);
      setLocationError(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission is required while you are online.'
          : 'Could not determine your current location.'
      );
    };

    const watchId = navigator.geolocation.watchPosition(
      sendLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      setLocationTracking(false);
    };
  }, [isAvailable]);

  async function handleAction(id: string, action: 'accept' | 'start' | 'complete') {
    setActionLoadingId(id);
    setActionError(null);
    try {
      if (action === 'accept') {
        await acceptBooking(id);
      }

      if (action === 'start') {
        await startBooking(id);
        setIsAvailable(false);
        setDriverProfile((current) =>
          current ? { ...current, isAvailable: false } : current
        );
      }

      if (action === 'complete') {
        await completeBooking(id);
        setIsAvailable(true);
        setDriverProfile((current) =>
          current ? { ...current, isAvailable: true } : current
        );
      }

      await loadRides();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this ride.');
    } finally {
      setActionLoadingId(null);
    }
  }

  const assignedRides = bookings.filter(
    (b) => b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'ONGOING'
  );
  // Offline drivers shouldn't see new (unaccepted) work, but keep whatever
  // they've already accepted visible so they can still finish it.
  const visibleAssigned = isAvailable ? assignedRides : assignedRides.filter((b) => b.status !== 'PENDING');
  const historyRides = bookings.filter((b) => b.status === 'COMPLETED' || b.status === 'CANCELLED');
  const completedCount = bookings.filter((b) => b.status === 'COMPLETED').length;
  const earnings = bookings.filter((b) => b.status === 'COMPLETED').reduce((sum, b) => sum + b.fare, 0);


  const driverName = driverProfile?.name ?? profile.name ?? 'Driver';
  const inr = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  const actionFor = (ride: Booking) => {
    const busy = actionLoadingId === ride.id;
    if (ride.status === 'PENDING') {
      return { action: 'accept' as const, label: busy ? 'Accepting…' : 'Accept trip' };
    }
    if (ride.status === 'CONFIRMED') {
      return { action: 'start' as const, label: busy ? 'Starting…' : 'Start trip' };
    }
    if (ride.status === 'ONGOING') {
      return { action: 'complete' as const, label: busy ? 'Completing…' : 'Complete trip' };
    }
    return null;
  };

  const renderRide = (ride: Booking, withActions: boolean) => {
    const next = withActions ? actionFor(ride) : null;

    return (
      <li key={ride.id} className={`ride-row ${ride.status === 'PENDING' ? 'is-request' : ''}`}>
        <div className="ride-row-top">
          <span className={`status-pill status-${ride.status.toLowerCase()}`}>
            {ride.status === 'PENDING' ? 'New request' : formatStatus(ride.status)}
          </span>
          <strong className="ride-fare">{inr(ride.fare)}</strong>
        </div>

        <div className="ride-route">
          <div className="ride-point">
            <span className="location-dot pickup" />
            <span>
              <small>Pickup</small>
              {ride.pickupLocation}
            </span>
          </div>
          <div className="ride-point">
            <span className="location-dot destination" />
            <span>
              <small>Drop-off</small>
              {ride.dropoffLocation}
            </span>
          </div>
        </div>

        {next && (
          <div className="ride-actions">
            <button
              type="button"
              className={`ride-action-${next.action}`}
              disabled={actionLoadingId === ride.id}
              onClick={() => handleAction(ride.id, next.action)}
            >
              {next.label}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="driver-dashboard">
      <header className="driver-header">
        <span className="brand-row">
          <BrandMark inverted />
          <span className="brand">Jhanvi Cars</span>
          <span className="role-pill">Driver</span>
        </span>

        <div className="header-right">
          <div className="profile-menu">
            <button
              type="button"
              className="profile-button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
            >
              <span className="profile-avatar">{driverName.charAt(0).toUpperCase()}</span>
              <span className="profile-button-name">{driverName}</span>
              <span className={`profile-chevron ${profileOpen ? 'open' : ''}`} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-head">
                  <span className="profile-avatar large">{driverName.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{driverName}</strong>
                    <span>
                      {driverProfile?.rating
                        ? `${driverProfile.rating.averageRating.toFixed(2)} ★ rating`
                        : 'Jhanvi Cars driver'}
                    </span>
                  </div>
                </div>

                <dl className="profile-details">
                  <div className="profile-detail"><dt>Email</dt><dd>{driverProfile?.email ?? profile.email ?? '—'}</dd></div>
                  <div className="profile-detail"><dt>Mobile</dt><dd>{driverProfile?.phone ?? '—'}</dd></div>
                  <div className="profile-detail"><dt>License</dt><dd>{driverProfile?.licenseNumber ?? '—'}</dd></div>
                  <div className="profile-detail"><dt>Vehicle</dt><dd>{driverProfile?.vehicleModel ?? '—'}</dd></div>
                  <div className="profile-detail"><dt>Type</dt><dd>{driverProfile?.vehicleType ?? '—'}</dd></div>
                  <div className="profile-detail"><dt>Plate</dt><dd>{driverProfile?.vehicleNumber ?? '—'}</dd></div>
                </dl>

                <button type="button" className="logout-button profile-logout" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="driver-body">
        {/* Online / offline hero */}
        <section className={`driver-status-card ${isAvailable ? 'is-online' : 'is-offline'}`}>
          <div className="driver-status-copy">
            <span className="driver-status-label">
              <span className="driver-status-dot" aria-hidden="true" />
              {isAvailable ? 'You’re online' : 'You’re offline'}
            </span>
            <h1 className="panel-heading">
              {isAvailable ? 'Finding trips near you' : `Ready to drive, ${driverName.split(' ')[0]}?`}
            </h1>
            <p className="vehicle-line">
              {driverProfile?.vehicleModel ?? profile.vehicle?.type ?? 'Your vehicle'}
              {(driverProfile?.vehicleNumber ?? profile.vehicle?.plateNumber) && (
                <> · <span className="plate">{driverProfile?.vehicleNumber ?? profile.vehicle?.plateNumber}</span></>
              )}
            </p>

            {isAvailable && (
              <span className={`location-sharing-status ${locationError ? 'location-sharing-error' : ''}`}>
                <span className={`location-sharing-led ${locationTracking && !locationError ? 'on' : ''}`} aria-hidden="true" />
                {locationError
                  ? 'Location sharing off'
                  : locationTracking
                    ? 'Sharing live location'
                    : 'Getting your location…'}
              </span>
            )}
          </div>

          <button
            type="button"
            className={`go-button ${isAvailable ? 'on' : ''}`}
            onClick={toggleAvailability}
            disabled={availabilityLoading}
            aria-pressed={isAvailable}
            aria-label={isAvailable ? 'Go offline' : 'Go online'}
          >
            {availabilityLoading ? <span className="go-spinner" aria-hidden="true" /> : isAvailable ? 'STOP' : 'GO'}
          </button>
        </section>

        {availabilityError && <p className="error-text">{availabilityError}</p>}
        {locationError && <p className="error-text">{locationError}</p>}

        {/* Earnings */}
        <section className="earnings-card" aria-label="Earnings">
          <div className="earnings-hero">
            <span className="summary-label">Today</span>
            <span className="summary-value">{inr(driverProfile?.earnings?.todayEarnings ?? 0)}</span>
          </div>
          <div className="earnings-grid">
            <div>
              <span className="summary-label">This week</span>
              <span className="summary-value">{inr(driverProfile?.earnings?.weekEarnings ?? 0)}</span>
            </div>
            <div>
              <span className="summary-label">All time</span>
              <span className="summary-value">{inr(driverProfile?.earnings?.totalEarnings ?? earnings)}</span>
            </div>
            <div>
              <span className="summary-label">Trips</span>
              <span className="summary-value">{driverProfile?.earnings?.totalTrips ?? completedCount}</span>
            </div>
            <div>
              <span className="summary-label">Rating</span>
              <span className="summary-value">
                {driverProfile?.rating ? `${driverProfile.rating.averageRating.toFixed(2)} ★` : '—'}
              </span>
            </div>
          </div>
        </section>

        {/* Trips */}
        <section className="rides-section">
          <div className="rides-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'assigned'}
              className={tab === 'assigned' ? 'active' : ''}
              onClick={() => setTab('assigned')}
            >
              Trips ({visibleAssigned.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              className={tab === 'history' ? 'active' : ''}
              onClick={() => setTab('history')}
            >
              History ({historyRides.length})
            </button>
          </div>

          {ridesLoading && <p className="hint-text">Loading trips…</p>}
          {ridesError && <p className="error-text">{ridesError}</p>}
          {actionError && <p className="error-text">{actionError}</p>}

          {!ridesLoading && !ridesError && tab === 'assigned' && (
            <ul className="rides-list">
              {!isAvailable && visibleAssigned.length === 0 && (
                <li className="rides-empty">
                  <strong>You’re offline</strong>
                  <span>Tap GO to start receiving trip requests.</span>
                </li>
              )}
              {isAvailable && visibleAssigned.length === 0 && (
                <li className="rides-empty">
                  <strong>No trips right now</strong>
                  <span>Stay online — new requests show up here automatically.</span>
                </li>
              )}
              {visibleAssigned.map((ride) => renderRide(ride, true))}
            </ul>
          )}

          {!ridesLoading && !ridesError && tab === 'history' && (
            <ul className="rides-list">
              {historyRides.length === 0 && (
                <li className="rides-empty">
                  <strong>No past trips yet</strong>
                  <span>Completed trips will be listed here.</span>
                </li>
              )}
              {historyRides.map((ride) => renderRide(ride, false))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
