import { useEffect, useState } from 'react';
import { getMe } from '../api/auth';
import { setAvailability, setOnline, updateLocation, getDriverProfile, type DriverProfile } from '../api/drivers';
import { getBookings, acceptBooking, startBooking, completeBooking } from '../api/bookings';
import { ApiError } from '../api/client';
import { formatStatus } from '../utils/format';
import type { AuthUser, Booking } from '../types';
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
      await setAvailability(next);
      await setOnline(next);

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
          : 'Could not update your availability.'
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


  return (
    <div className="driver-dashboard">
      <header className="driver-header">
        <span>
          <span className="brand">Jhanvi Cars</span>
        </span>
        <div className="header-right">
          <span className="role-pill">Driver</span>

          <div className="profile-menu">
            <button
              type="button"
              className="profile-button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
            >
              <span className="profile-avatar">
                {(driverProfile?.name ?? profile.name ?? 'D').charAt(0).toUpperCase()}
              </span>
              <span className="profile-button-name">
                {driverProfile?.name ?? profile.name ?? 'Driver'}
              </span>
              <span className="profile-chevron">⌄</span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-title">Driver profile</div>

                <div className="profile-detail">
                  <span>Name</span>
                  <strong>{driverProfile?.name ?? profile.name ?? '—'}</strong>
                </div>

                <div className="profile-detail">
                  <span>Email</span>
                  <strong>{driverProfile?.email ?? profile.email ?? '—'}</strong>
                </div>

                <div className="profile-detail">
                  <span>Mobile</span>
                  <strong>{driverProfile?.phone ?? '—'}</strong>
                </div>

                <div className="profile-detail">
                  <span>License</span>
                  <strong>{driverProfile?.licenseNumber ?? '—'}</strong>
                </div>

                <div className="profile-detail">
                  <span>Vehicle type</span>
                  <strong>{driverProfile?.vehicleType ?? '—'}</strong>
                </div>

                <div className="profile-detail">
                  <span>Vehicle model</span>
                  <strong>{driverProfile?.vehicleModel ?? '—'}</strong>
                </div>

                <div className="profile-detail">
                  <span>Vehicle number</span>
                  <strong>{driverProfile?.vehicleNumber ?? '—'}</strong>
                </div>

                <div className="profile-detail">
                  <span>Status</span>
                  <strong>{driverProfile?.isAvailable ? 'Online' : 'Offline'}</strong>
                </div>

                <button className="logout-button profile-logout" onClick={onLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="driver-body">
        <section className="driver-profile-card">
          <div>
            <h1 className="panel-heading">{profile.name ?? 'Driver'}</h1>
            {profile.vehicle && (
              <p className="vehicle-line">
                {profile.vehicle.type} · {profile.vehicle.plateNumber}
              </p>
            )}
          </div>
          <div className="availability-toggle">
            <span>{isAvailable ? 'Online' : 'Offline'}</span>
            <button
              type="button"
              className={`toggle-switch ${isAvailable ? 'on' : ''}`}
              onClick={toggleAvailability}
              disabled={availabilityLoading}
              aria-pressed={isAvailable}
              aria-label="Toggle online status"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </section>

        {availabilityLoading && <p className="hint-text">Updating availability…</p>}
        {availabilityError && <p className="error-text">{availabilityError}</p>}

        {locationError && (
          <div className="location-sharing-status location-sharing-error">
            <span className="location-sharing-icon">📍</span>
            <span className="location-sharing-label">Location</span>
            <span className="location-sharing-state">OFF</span>
          </div>
        )}

        {isAvailable && !locationError && (
          <div className="location-sharing-status">
            <span className="location-sharing-icon">📍</span>
            <span className="location-sharing-label">Location</span>
            <span className={locationTracking ? 'status-on' : 'status-off'}>
              {locationTracking ? 'ON' : 'OFF'}
            </span>
          </div>
        )}

        <section className="earnings-card">
          <div>
            <span className="summary-label">Total trips</span>
            <span className="summary-value">
              {driverProfile?.earnings?.totalTrips ?? completedCount}
            </span>
          </div>
          <div>
            <span className="summary-label">Total earnings</span>
            <span className="summary-value fare">
              ₹{driverProfile?.earnings?.totalEarnings ?? earnings}
            </span>
          </div>
          <div>
            <span className="summary-label">Today</span>
            <span className="summary-value fare">
              ₹{driverProfile?.earnings?.todayEarnings ?? 0}
            </span>
          </div>
          <div>
            <span className="summary-label">This week</span>
            <span className="summary-value fare">
              ₹{driverProfile?.earnings?.weekEarnings ?? 0}
            </span>
          </div>
          <div>
            <span className="summary-label">Rating</span>
            <span className="summary-value">
              {driverProfile?.rating
                ? `${driverProfile.rating.averageRating.toFixed(1)} ★`
                : '—'}
            </span>
          </div>
        </section>

        <section className="rides-section">
          <div className="rides-tabs">
            <button className={tab === 'assigned' ? 'active' : ''} onClick={() => setTab('assigned')}>
              Assigned ({visibleAssigned.length})
            </button>
            <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
              History ({historyRides.length})
            </button>
          </div>

          {ridesLoading && <p className="hint-text">Loading rides…</p>}
          {ridesError && <p className="error-text">{ridesError}</p>}
          {actionError && <p className="error-text">{actionError}</p>}

          {!ridesLoading && !ridesError && tab === 'assigned' && (
            <ul className="rides-list">
              {!isAvailable && <li className="hint-text">Go online to see new ride requests.</li>}
              {isAvailable && visibleAssigned.length === 0 && <li className="hint-text">No assigned rides right now.</li>}
              {visibleAssigned.map((ride) => (
                <li key={ride.id} className="ride-row">
                  <div className="ride-route">
                    <div className="ride-point">
                      <span className="location-dot pickup" />
                      {ride.pickupLocation}
                    </div>
                    <div className="ride-point">
                      <span className="location-dot destination" />
                      {ride.dropoffLocation}
                    </div>
                  </div>
                  <div className="ride-meta">
                    <span className={`status-pill status-${ride.status.toLowerCase()}`}>{formatStatus(ride.status)}</span>
                    <span>₹{ride.fare}</span>
                  </div>
                  <div className="ride-actions">
                    {ride.status === 'PENDING' && (
                      <button disabled={actionLoadingId === ride.id} onClick={() => handleAction(ride.id, 'accept')}>
                        {actionLoadingId === ride.id ? 'Accepting…' : 'Accept'}
                      </button>
                    )}
                    {ride.status === 'CONFIRMED' && (
                      <button disabled={actionLoadingId === ride.id} onClick={() => handleAction(ride.id, 'start')}>
                        {actionLoadingId === ride.id ? 'Starting…' : 'Start ride'}
                      </button>
                    )}
                    {ride.status === 'ONGOING' && (
                      <button disabled={actionLoadingId === ride.id} onClick={() => handleAction(ride.id, 'complete')}>
                        {actionLoadingId === ride.id ? 'Completing…' : 'Complete ride'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!ridesLoading && !ridesError && tab === 'history' && (
            <ul className="rides-list">
              {historyRides.length === 0 && <li className="hint-text">No past rides yet.</li>}
              {historyRides.map((ride) => (
                <li key={ride.id} className="ride-row">
                  <div className="ride-route">
                    <div className="ride-point">
                      <span className="location-dot pickup" />
                      {ride.pickupLocation}
                    </div>
                    <div className="ride-point">
                      <span className="location-dot destination" />
                      {ride.dropoffLocation}
                    </div>
                  </div>
                  <div className="ride-meta">
                    <span className={`status-pill status-${ride.status.toLowerCase()}`}>{formatStatus(ride.status)}</span>
                    <span>₹{ride.fare}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
