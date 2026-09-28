import { useEffect, useRef, useState } from 'react';
import BrandMark from './BrandMark';
import { RideIcon } from './RideIcons';
import GoogleRideMap from './GoogleRideMap';
import { loadGoogleMaps, attachAutocomplete, computeRoute } from '../api/googleMaps';
import { cancelBooking, createBooking, getBookings } from '../api/bookings';
import { estimateFare, type RideType } from '../utils/fare';
import { formatStatus } from '../utils/format';
import { ApiError } from '../api/client';
import type { AuthUser, Booking, LocationPoint, RouteResult } from '../types';
import './CustomerDashboard.css';

interface CustomerDashboardProps {
  user?: AuthUser;
  onLogout?: () => void;
  onRequireAuth?: () => void;
}



function getRideVehicleIcon(vehicleType?: string): string {
  switch (vehicleType) {
    case 'AUTO':
      return '🛺';
    case 'ECONOMY':
      return '🚕';
    case 'COMFORT':
      return '🚘';
    case 'COMFORT_PLUS':
      return '🚙';
    default:
      return '🚗';
  }
}

const rideOptions: Array<{
  type: RideType;
  label: string;
  subtitle: string;
  range: string;
  eta: string;
}> = [
  {
    type: 'AUTO',
    label: 'Auto',
    subtitle: '',
    range: '₹100 – ₹140',
    eta: '2–3 min',
  },
  {
    type: 'ECONOMY',
    label: 'Economy',
    subtitle: 'Non-AC',
    range: '₹120 – ₹160',
    eta: '2–3 min',
  },
  {
    type: 'COMFORT',
    label: 'Comfort',
    subtitle: 'AC',
    range: '₹150 – ₹200',
    eta: '3–5 min',
  },
  {
    type: 'COMFORT_PLUS',
    label: 'Comfort Plus',
    subtitle: 'AC Premium',
    range: '₹200 – ₹280',
    eta: '4–6 min',
  },
];

function getCustomerRideMessage(status: Booking['status']): string {
  switch (status) {
    case 'PENDING':
      return 'Finding a driver for your ride';
    case 'CONFIRMED':
      return 'Your driver has accepted the ride';
    case 'ONGOING':
      return 'Your ride is in progress';
    case 'COMPLETED':
      return 'Your ride has been completed';
    case 'CANCELLED':
      return 'This ride was cancelled';
    default:
      return '';
  }
}

function getStatusClass(status: Booking['status']): string {
  return `status-${status.toLowerCase()}`;
}

export default function CustomerDashboard({
  user,
  onLogout,
  onRequireAuth,
}: CustomerDashboardProps) {
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [rideType, setRideType] = useState<RideType>('ECONOMY');
  const [showHistory, setShowHistory] = useState(false);
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);

  useEffect(() => {
    let pickupAutocomplete: google.maps.places.Autocomplete | undefined;
    let destAutocomplete: google.maps.places.Autocomplete | undefined;
    let cancelled = false;

    loadGoogleMaps()
      .then(async () => {
        if (cancelled) return;

        if (pickupInputRef.current) {
          pickupAutocomplete = await attachAutocomplete(
            pickupInputRef.current,
            setPickup,
          );
        }

        if (destInputRef.current) {
          destAutocomplete = await attachAutocomplete(
            destInputRef.current,
            setDestination,
          );
        }
      })
      .catch(() =>
        setPlacesError(
          'Could not load location search. Check your connection or API key.',
        ),
      );

    return () => {
      cancelled = true;
      if (pickupAutocomplete) {
        google.maps.event.clearInstanceListeners(pickupAutocomplete);
      }
      if (destAutocomplete) {
        google.maps.event.clearInstanceListeners(destAutocomplete);
      }
    };
  }, []);

  useEffect(() => {
    if (!pickup || !destination) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);

    computeRoute(pickup, destination)
      .then((result) => {
        if (!cancelled) setRoute(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setRouteError(
            err instanceof Error
              ? err.message
              : 'Could not calculate the route.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pickup, destination]);

  function loadRides() {
    if (!user) {
      setBookings([]);
      setRidesError(null);
      setRidesLoading(false);
      return;
    }

    setRidesLoading(true);
    setRidesError(null);

    getBookings()
      .then(setBookings)
      .catch((err) =>
        setRidesError(
          err instanceof ApiError
            ? err.message
            : 'Could not load your rides.',
        ),
      )
      .finally(() => setRidesLoading(false));
  }

  useEffect(loadRides, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (user && document.visibilityState === 'visible') {
        getBookings()
          .then(setBookings)
          .catch((err) => {
            if (err instanceof ApiError) {
              setRidesError(err.message);
            }
          });
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [user]);

  function clearLocations() {
    setPickup(null);
    setDestination(null);
    setRoute(null);
    setRouteError(null);

    if (pickupInputRef.current) pickupInputRef.current.value = '';
    if (destInputRef.current) destInputRef.current.value = '';
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setPlacesError('Location services are not supported by this browser.');
      return;
    }

    setPlacesError(null);
    setRouteError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          await loadGoogleMaps();

          const googleApi = (
            window as typeof window & {
              google?: typeof google;
            }
          ).google;

          if (!googleApi?.maps) {
            throw new Error('Google Maps could not be loaded.');
          }

          const geocoder = new googleApi.maps.Geocoder();

          const response = await geocoder.geocode({
            location: { lat: latitude, lng: longitude },
          });

          const address =
            response.results[0]?.formatted_address ??
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

          const currentLocation: LocationPoint = {
            address,
            lat: latitude,
            lng: longitude,
          };

          setPickup(currentLocation);

          if (pickupInputRef.current) {
            pickupInputRef.current.value = address;
          }
        } catch (err) {
          setPlacesError(
            err instanceof Error
              ? err.message
              : 'Could not determine your current location.',
          );
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setPlacesError(
              'Location permission was denied. Please allow location access in your browser.',
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setPlacesError(
              'Your current location is unavailable. Please try again.',
            );
            break;
          case error.TIMEOUT:
            setPlacesError(
              'Location request timed out. Please try again.',
            );
            break;
          default:
            setPlacesError('Could not determine your current location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  }

  async function handleCancelRide(bookingId: string) {
    if (cancellingRideId) return;

    const confirmed = window.confirm(
      'Are you sure you want to cancel this ride?',
    );

    if (!confirmed) return;

    setCancellingRideId(bookingId);
    setRidesError(null);

    try {
      await cancelBooking(bookingId);
      await loadRides();
    } catch (err) {
      setRidesError(
        err instanceof ApiError
          ? err.message
          : 'Could not cancel your ride. Please try again.',
      );
    } finally {
      setCancellingRideId(null);
    }
  }

  async function handleBook() {
    if (!pickup || !destination || !route || booking) return;

    if (!user) {
      onRequireAuth?.();
      return;
    }

    setBooking(true);
    setBookError(null);

    try {
      await createBooking({
        pickupLocation: pickup.address,
        dropoffLocation: destination.address,
        fare: estimateFare(route, rideType),
        scheduledAt: new Date().toISOString(),
        vehicleType: rideType,
      });

      clearLocations();
      loadRides();
    } catch (err) {
      setBookError(
        err instanceof ApiError
          ? err.message
          : 'Could not book your ride. Please try again.',
      );
    } finally {
      setBooking(false);
    }
  }

  const fare = route ? estimateFare(route, rideType) : null;
  const activeRides = bookings.filter(
    (b) => b.status !== 'COMPLETED' && b.status !== 'CANCELLED',
  );
  const historyRides = bookings.filter(
    (b) => b.status === 'COMPLETED' || b.status === 'CANCELLED',
  );

  const visibleRides = showHistory ? historyRides : activeRides;

  return (
    <div className="customer-app">
      <header className="customer-topbar">
        <div className="customer-brand">
          <BrandMark />
          <span>Jhanvi Cars</span>
        </div>

        <nav className="customer-nav" aria-label="Customer navigation">
          <button className="nav-item active">Book Ride</button>
          {user && (
            <button
              className={`nav-item ${showHistory ? 'active-history' : ''}`}
              onClick={() => setShowHistory(true)}
            >
              My Rides
            </button>
          )}
        </nav>

        <div className="customer-account">
          {user ? (
            <>
              <div className="account-avatar">
                {(user.name || 'C').slice(0, 1).toUpperCase()}
              </div>
              <div className="account-copy">
                <strong>{user.name || 'Customer'}</strong>
                <span>Customer</span>
              </div>
              <button
                className="account-menu"
                onClick={onLogout}
                title="Log out"
                aria-label="Log out"
              >
                ⋮
              </button>
            </>
          ) : (
            <button className="guest-login" onClick={onRequireAuth}>
              Log in
            </button>
          )}
        </div>
      </header>

      <main className="customer-content">
        <section className="booking-card">
          <div className="booking-heading">
            <div>
              <span className="eyebrow">BOOK A RIDE</span>
              <h1>Where would you like to go?</h1>
              <p>Choose your pickup and destination to get started.</p>
            </div>

            <button
              className="location-button"
              type="button"
              onClick={handleUseCurrentLocation}
            >
              <span>⌖</span>
              Use current location
            </button>
          </div>

          {placesError && <p className="error-text">{placesError}</p>}

          <div className="location-stack">
            <label className="location-box">
              <span className="location-icon pickup-icon">●</span>
              <span className="location-copy">
                <small>Pickup location</small>
                <input
                  ref={pickupInputRef}
                  placeholder="Search pickup location"
                  autoComplete="off"
                />
              </span>
              {pickup && (
                <button
                  className="clear-location"
                  type="button"
                  onClick={() => {
                    setPickup(null);
                    setRoute(null);
                    if (pickupInputRef.current) {
                      pickupInputRef.current.value = '';
                    }
                  }}
                  aria-label="Clear pickup"
                >
                  ×
                </button>
              )}
            </label>

            <div className="route-connector" />

            <label className="location-box">
              <span className="location-icon destination-icon">●</span>
              <span className="location-copy">
                <small>Destination</small>
                <input
                  ref={destInputRef}
                  placeholder="Search destination"
                  autoComplete="off"
                />
              </span>
              {destination && (
                <button
                  className="clear-location"
                  type="button"
                  onClick={() => {
                    setDestination(null);
                    setRoute(null);
                    if (destInputRef.current) {
                      destInputRef.current.value = '';
                    }
                  }}
                  aria-label="Clear destination"
                >
                  ×
                </button>
              )}
            </label>
          </div>

          {routeLoading && (
            <div className="route-loading">
              <span className="loading-dot" />
              Calculating your route…
            </div>
          )}

          {routeError && <p className="error-text">{routeError}</p>}

          <div className="section-heading">
            <div>
              <span className="eyebrow">CHOOSE YOUR RIDE</span>
              <h2>How would you like to travel?</h2>
            </div>
          </div>

          <div className="ride-options">
            {rideOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className={`ride-option ${
                  rideType === option.type ? 'selected' : ''
                }`}
                onClick={() => setRideType(option.type)}
              >
                <span className="ride-option-check">
                  {rideType === option.type ? '✓' : ''}
                </span>
                <span className={`ride-option-icon ride-icon-${option.type.toLowerCase()}`}>
                  <RideIcon type={option.type} />
                </span>
                <strong>{option.label}</strong>
                <span className="ride-subtitle">{option.subtitle}</span>
                <span className="ride-range">{option.range}</span>
                <small>{option.eta}</small>
              </button>
            ))}
          </div>

          <div className="fare-summary">
            <div className="fare-stat">
              <span className="stat-icon">₹</span>
              <span>
                <small>Estimated fare</small>
                <strong>{fare ? `₹${fare}` : '—'}</strong>
              </span>
            </div>

            <div className="stat-divider" />

            <div className="fare-stat">
              <span className="stat-icon">⌁</span>
              <span>
                <small>Distance</small>
                <strong>{route ? `${route.distanceKm} km` : '—'}</strong>
              </span>
            </div>

            <div className="stat-divider" />

            <div className="fare-stat">
              <span className="stat-icon">◷</span>
              <span>
                <small>Est. time</small>
                <strong>{route ? `${route.durationMin} min` : '—'}</strong>
              </span>
            </div>
          </div>

          {bookError && <p className="error-text">{bookError}</p>}

          <button
            className="primary-book-button"
            disabled={!route || routeLoading || booking}
            onClick={handleBook}
          >
            {booking
        ? 'Booking your ride…'
        : fare
          ? `Book ${rideOptions.find((option) => option.type === rideType)?.label ?? 'ride'} · ₹${fare}`
          : 'Book ride'}
          </button>

          {!user && (
            <p className="booking-login-note">
              You can plan your ride first. <button onClick={onRequireAuth}>Log in</button> when you are ready to book.
            </p>
          )}
        </section>

        <section className="map-card">
          <div className="map-card-header">
            <div>
              <span className="eyebrow">LIVE ROUTE</span>
              <h2>Your journey</h2>
            </div>

            {route && (
              <div className="map-route-meta">
                <strong>{route.distanceKm} km</strong>
                <span>•</span>
                <strong>{route.durationMin} min</strong>
              </div>
            )}
          </div>

          <div className="map-frame">
            <GoogleRideMap
              pickup={pickup}
              destination={destination}
              route={route}
            />

            {route && (
              <div className="map-floating-summary">
                <span className="map-car">🚗</span>
                <span>
                  <strong>{route.distanceKm} km · {route.durationMin} mins</strong>
                  <small>Fastest available route</small>
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className="rides-column">
          <div className="rides-column-header">
            <div>
              <span className="eyebrow">
                {showHistory ? 'PAST TRIPS' : 'YOUR JOURNEYS'}
              </span>
              <h2>{showHistory ? 'Ride History' : `Active Rides (${activeRides.length})`}</h2>
            </div>

            {user && (
              <button
                className="view-all-button"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? 'Active rides' : 'View history'} →
              </button>
            )}
          </div>

          {!user ? (
            <div className="guest-rides-card">
              <div className="guest-rides-icon">🚘</div>
              <h3>Your rides will appear here</h3>
              <p>Log in after choosing your route to book and track your rides.</p>
              <button onClick={onRequireAuth}>Log in to continue</button>
            </div>
          ) : ridesLoading ? (
            <div className="empty-rides">
              <span className="spinner" />
              Loading your rides…
            </div>
          ) : ridesError ? (
            <div className="empty-rides error-state">{ridesError}</div>
          ) : visibleRides.length === 0 ? (
            <div className="empty-rides">
              <span className="empty-icon">{showHistory ? '🧾' : '🚗'}</span>
              <strong>{showHistory ? 'No ride history yet' : 'No active rides'}</strong>
              <p>
                {showHistory
                  ? 'Your completed trips will appear here.'
                  : 'Book a ride and we will track it here.'}
              </p>
            </div>
          ) : (
            <div className="ride-list">
              {visibleRides.map((ride) => (
                <article key={ride.id} className="customer-ride-card">
                  <div className={`ride-status ${getStatusClass(ride.status)}`}>
                    <span className="status-dot" />
                    <strong>{formatStatus(ride.status)}</strong>
                    {ride.status === 'PENDING' && (
                      <button
                        type="button"
                        className="cancel-look"
                        aria-label="Cancel ride"
                        disabled={cancellingRideId === ride.id}
                        onClick={() => handleCancelRide(ride.id)}
                      >
                        {cancellingRideId === ride.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>

                  <div className="ride-card-main">
                    <div className="ride-vehicle-icon">
                      {getRideVehicleIcon(ride.vehicleType)}
                    </div>

                    <div className="ride-card-title">
                      <strong>
                        {ride.status === 'PENDING'
                          ? 'Finding a driver…'
                          : ride.status === 'CONFIRMED'
                            ? 'Driver accepted'
                            : ride.status === 'ONGOING'
                              ? 'Ride in progress'
                              : formatStatus(ride.status)}
                      </strong>
                      <span>
                        {new Date(ride.scheduledAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <strong className="ride-price">₹{ride.fare}</strong>
                  </div>

                  <div className="ride-route-lines">
                    <div>
                      <span className="timeline-dot pickup-timeline" />
                      <p>{ride.pickupLocation}</p>
                    </div>
                    <div>
                      <span className="timeline-dot destination-timeline" />
                      <p>{ride.dropoffLocation}</p>
                    </div>
                  </div>

                  <div className="ride-message">
                    {getCustomerRideMessage(ride.status)}
                  </div>

                  {ride.status === 'CONFIRMED' && (
                    <div className="driver-preview">
                      <div className="driver-avatar">D</div>
                      <div>
                        <strong>Your driver is on the way</strong>
                        <span>Driver details will appear here</span>
                      </div>
                      <span className="driver-call">☎</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
