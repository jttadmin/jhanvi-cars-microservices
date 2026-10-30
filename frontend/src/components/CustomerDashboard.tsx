import { useEffect, useRef, useState } from 'react';
import BrandMark from './BrandMark';
import { RideIcon } from './RideIcons';
import GoogleRideMap from './GoogleRideMap';
import { loadGoogleMaps, attachAutocomplete, computeRoute } from '../api/googleMaps';
import { cancelBooking, createBooking, getBookingsWithRefundStatus } from '../api/bookings';
import {
  createPayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../api/payments';
import {
  loadRazorpayCheckout,
  type RazorpayResponse,
} from '../utils/razorpay';
import { estimateFare, type RideType } from '../utils/fare';
import { formatStatus } from '../utils/format';
import { ApiError } from '../api/client';
import { updateProfile } from '../api/auth';
import type { AuthUser, Booking, LocationPoint, RouteResult } from '../types';
import './CustomerDashboard.css';

interface CustomerDashboardProps {
  user?: AuthUser;
  onLogout?: () => void;
  onRequireAuth?: () => void;
  onUserUpdated?: (user: AuthUser) => void;
}



const RIDE_TYPES: RideType[] = ['AUTO', 'ECONOMY', 'COMFORT', 'COMFORT_PLUS'];

function asRideType(vehicleType?: string): RideType {
  return RIDE_TYPES.includes(vehicleType as RideType)
    ? (vehicleType as RideType)
    : 'ECONOMY';
}

function getRideTitle(ride: Booking): string {
  switch (ride.status) {
    case 'PENDING':
      return 'Finding your driver…';
    case 'CONFIRMED':
      return ride.driverId ? 'Driver is on the way' : 'Confirming your driver…';
    case 'ONGOING':
      return 'On the way to destination';
    default:
      return formatStatus(ride.status);
  }
}

function formatRideTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

function getCustomerRideMessage(ride: Booking): string {
  switch (ride.status) {
    case 'PENDING':
      return 'Finding a driver for your ride';
    case 'CONFIRMED':
      return ride.driverId
        ? 'Your driver has accepted the ride'
        : 'Confirming driver assignment…';
    case 'ONGOING':
      return 'Your ride is in progress';
    case 'COMPLETED':
      return 'Your ride has been completed';
    case 'CANCELLED':
      if (
        ride.refundStatus === 'REQUESTED' ||
        ride.refundStatus === 'PENDING'
      ) {
        return 'Ride cancelled — refund processing';
      }
      if (
        ride.refundStatus === 'PROCESSED' ||
        ride.paymentStatus === 'REFUNDED'
      ) {
        return 'Ride cancelled — refund completed';
      }
      if (ride.refundStatus === 'FAILED') {
        return 'Ride cancelled — refund failed; please contact support';
      }
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
  onUserUpdated,
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
  const [panelView, setPanelView] = useState<'ride' | 'activity'>('ride');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEmail, setProfileEmail] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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

    getBookingsWithRefundStatus()
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
        getBookingsWithRefundStatus()
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

  function handleSwapLocations() {
    if (!pickup && !destination) return;

    const previousPickup = pickup;
    const previousDestination = destination;

    setPickup(previousDestination);
    setDestination(previousPickup);
    setRoute(null);
    setRouteError(null);

    if (pickupInputRef.current) {
      pickupInputRef.current.value = previousDestination?.address ?? '';
    }

    if (destInputRef.current) {
      destInputRef.current.value = previousPickup?.address ?? '';
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
      const fareAmount = estimateFare(route, rideType);

      /*
       * Step 1:
       * Create the booking first.
       */
      const createdBooking = await createBooking({
        pickupLocation: pickup.address,
        dropoffLocation: destination.address,
        fare: fareAmount,
        scheduledAt: new Date().toISOString(),
        vehicleType: rideType,
      });

      /*
       * Step 2:
       * Create the application's payment record.
       */
      const payment = await createPayment({
        bookingId: createdBooking.id,
        userId: user.id,
        amount: fareAmount,
        currency: 'INR',
        method: 'UPI',
      });

      /*
       * Step 3:
       * Ask the backend to create the Razorpay order.
       */
      const razorpayOrder =
        await createRazorpayOrder(payment.id);

      /*
       * Step 4:
       * Load Razorpay Checkout.js.
       */
      await loadRazorpayCheckout();

      if (!window.Razorpay) {
        throw new Error(
          'Razorpay Checkout is unavailable. Please try again.',
        );
      }

      /*
       * Step 5:
       * Open Razorpay Checkout.
       */
      const options = {
        key: razorpayOrder.keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'Jhanvi Cars',
        description: `Ride payment for booking ${createdBooking.id}`,
        order_id: razorpayOrder.orderId,
        prefill: {
          name: user.name ?? '',
          email: user.email ?? '',
          contact: user.mobileNumber ?? '',
        },
        theme: {
          color: '#000000',
        },
        handler: async (
          response: RazorpayResponse,
        ) => {
          try {
            /*
             * Step 6:
             * Verify the Razorpay signature on the backend.
             */
            await verifyRazorpayPayment(
              payment.id,
              {
                razorpayOrderId:
                  response.razorpay_order_id,
                razorpayPaymentId:
                  response.razorpay_payment_id,
                razorpaySignature:
                  response.razorpay_signature,
              },
            );

            clearLocations();
            await loadRides();
          } catch (error) {
            setBookError(
              error instanceof ApiError
                ? error.message
                : 'Payment verification failed. Please contact support if money was deducted.',
            );
          } finally {
            setBooking(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBookError(
              'Payment was cancelled. Your ride has not been confirmed.',
            );
            setBooking(false);
          },
        },
      };

      const razorpay =
        new window.Razorpay(options);

      razorpay.open();
    } catch (err) {
      setBookError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not start payment. Please try again.',
      );

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

  const openProfile = () => {
    if (!user) return;

    setProfileEmail(user.email ?? '');
    setProfileMobile(user.mobileNumber ?? '');
    setProfileError(null);
    setProfileSuccess(null);
    setProfileMenuOpen(false);
    setProfileOpen(true);
  };

  const closeProfile = () => {
    if (profileSaving) return;

    setProfileOpen(false);
    setProfileError(null);
    setProfileSuccess(null);
  };

  const handleProfileSave = async () => {
    if (!user) return;

    const email = profileEmail.trim();
    const mobileNumber = profileMobile.trim();

    if (!email) {
      setProfileError('Email address is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError('Please enter a valid email address.');
      return;
    }

    if (!/^[0-9]{10}$/.test(mobileNumber)) {
      setProfileError('Mobile number must be exactly 10 digits.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const updatedUser = await updateProfile({
        email,
        mobileNumber,
      });

      onUserUpdated?.(updatedUser);

      setProfileEmail(updatedUser.email ?? '');
      setProfileMobile(updatedUser.mobileNumber ?? '');
      setProfileSuccess('Profile updated successfully.');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to update your profile. Please try again.';

      setProfileError(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const selectedOption =
    rideOptions.find((option) => option.type === rideType) ?? rideOptions[1];
  const liveRide = activeRides[0];
  const initial = (user?.name || 'C').slice(0, 1).toUpperCase();

  const openActivity = (history: boolean) => {
    setShowHistory(history);
    setPanelView('activity');
    setProfileMenuOpen(false);
  };

  return (
    <div className="customer-app">
      {/* Full-screen map */}
      <div className="customer-map">
        <GoogleRideMap
          pickup={pickup}
          destination={destination}
          route={route}
        />

        {route && (
          <div className="map-route-chip" aria-live="polite">
            <strong>{route.durationMin} min</strong>
            <span>{route.distanceKm} km</span>
          </div>
        )}
      </div>

      {/* Floating top bar */}
      <header className="customer-topbar">
        <div className="customer-brand">
          <BrandMark inverted />
          <span>Jhanvi Cars</span>
        </div>

        <nav className="customer-nav" aria-label="Customer navigation">
          <button
            type="button"
            className={`nav-item ${panelView === 'ride' ? 'active' : ''}`}
            onClick={() => setPanelView('ride')}
          >
            Ride
          </button>
          {user && (
            <button
              type="button"
              className={`nav-item ${panelView === 'activity' ? 'active' : ''}`}
              onClick={() => openActivity(false)}
            >
              Activity
              {activeRides.length > 0 && (
                <span className="nav-badge">{activeRides.length}</span>
              )}
            </button>
          )}
        </nav>

        <div className="customer-account">
          {user ? (
            <div className="account-profile-wrap">
              <button
                type="button"
                className="account-trigger"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
              >
                <span className="account-avatar">{initial}</span>
                <span className="account-name">{user.name || 'Customer'}</span>
                <span className={`account-chevron ${profileMenuOpen ? 'open' : ''}`} aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </button>

              {profileMenuOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-header">
                    <span className="profile-dropdown-avatar">{initial}</span>
                    <div>
                      <strong>{user.name || 'Customer'}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <button type="button" role="menuitem" className="profile-menu-item" onClick={openProfile}>
                    <strong>Manage account</strong>
                    <small>Email and mobile number</small>
                  </button>

                  <button type="button" role="menuitem" className="profile-menu-item" onClick={() => openActivity(true)}>
                    <strong>Trips</strong>
                    <small>Your past rides</small>
                  </button>

                  <button type="button" role="menuitem" className="profile-menu-item" disabled>
                    <strong>Wallet</strong>
                    <small>Coming soon</small>
                  </button>

                  <div className="profile-menu-divider" />

                  <button type="button" role="menuitem" className="profile-menu-item logout-item" onClick={onLogout}>
                    <strong>Sign out</strong>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="guest-actions">
              <button type="button" className="guest-login" onClick={onRequireAuth}>
                Log in
              </button>
              <button type="button" className="guest-signup" onClick={onRequireAuth}>
                Sign up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Booking / activity panel */}
      <main className="customer-panel">
        {panelView === 'ride' ? (
          <section className="panel-view" aria-labelledby="get-ride-title">
            <div className="panel-scroll">
              {liveRide && (
                <button
                  type="button"
                  className="live-ride-banner"
                  onClick={() => openActivity(false)}
                >
                  <span className={`live-dot ${getStatusClass(liveRide.status)}`} aria-hidden="true" />
                  <span className="live-ride-copy">
                    <strong>{getRideTitle(liveRide)}</strong>
                    <small>{liveRide.dropoffLocation}</small>
                  </span>
                  <span className="live-ride-cta">View</span>
                </button>
              )}

              <h1 id="get-ride-title" className="panel-title">Get a ride</h1>

              <div className="location-stack">
                <div className="location-rail" aria-hidden="true">
                  <span className="rail-dot" />
                  <span className="rail-line" />
                  <span className="rail-square" />
                </div>

                <div className="location-fields">
                  <label className={`location-box ${pickup ? 'has-value' : ''}`}>
                    <span className="sr-only">Pickup location</span>
                    <input
                      ref={pickupInputRef}
                      placeholder="Pickup location"
                      autoComplete="off"
                      aria-label="Pickup location"
                    />
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
                        aria-label="Clear pickup location"
                        title="Clear pickup location"
                      >
                        ×
                      </button>
                    )}
                  </label>

                  <label className={`location-box ${destination ? 'has-value' : ''}`}>
                    <span className="sr-only">Destination</span>
                    <input
                      ref={destInputRef}
                      placeholder="Where to?"
                      autoComplete="off"
                      aria-label="Destination"
                    />
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
                        title="Clear destination"
                      >
                        ×
                      </button>
                    )}
                  </label>
                </div>

                <button
                  className="swap-location"
                  type="button"
                  onClick={handleSwapLocations}
                  disabled={!pickup && !destination}
                  aria-label="Swap pickup and destination"
                  title="Swap pickup and destination"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M5.5 3v12M5.5 3 3 5.5M5.5 3 8 5.5M12.5 15V3M12.5 15 10 12.5M12.5 15l2.5-2.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              <button
                className="location-button"
                type="button"
                onClick={handleUseCurrentLocation}
              >
                <span className="location-button-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16"><path d="M14.5 1.5 1.5 7l5.5 2 2 5.5z" fill="currentColor" /></svg>
                </span>
                <span>
                  <strong>Use current location</strong>
                  <small>Set pickup to where you are now</small>
                </span>
              </button>

              {placesError && <p className="error-text">{placesError}</p>}

              {routeLoading && (
                <div className="route-loading">
                  <span className="loading-bar" />
                  Finding the best route…
                </div>
              )}

              {routeError && <p className="error-text">{routeError}</p>}

              <div className="section-heading">
                <h2>Choose a ride</h2>
                {!route && <span>Add a destination to see prices</span>}
              </div>

              <div className="ride-options" role="radiogroup" aria-label="Ride type">
                {rideOptions.map((option) => {
                  const optionFare = route ? estimateFare(route, option.type) : null;
                  const selected = rideType === option.type;

                  return (
                    <button
                      key={option.type}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`ride-option ${selected ? 'selected' : ''}`}
                      onClick={() => setRideType(option.type)}
                    >
                      <span className="ride-option-icon">
                        <RideIcon type={option.type} />
                      </span>

                      <span className="ride-option-copy">
                        <strong>{option.label}</strong>
                        <small>
                          {option.eta} away
                          {option.subtitle && <> · {option.subtitle}</>}
                        </small>
                      </span>

                      <span className="ride-option-price">
                        {optionFare !== null ? (
                          <strong>₹{optionFare}</strong>
                        ) : (
                          <small>{option.range}</small>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel-footer">
              <div className="payment-row">
                <span className="payment-icon" aria-hidden="true">₹</span>
                <span>UPI, cards &amp; netbanking</span>
                <small>via Razorpay</small>
              </div>

              {bookError && <p className="error-text">{bookError}</p>}

              <button
                type="button"
                className={`primary-book-button ${booking ? 'is-booking' : ''}`}
                disabled={!route || routeLoading || booking}
                onClick={handleBook}
              >
                {booking ? (
                  <>
                    <span className="book-spinner" aria-hidden="true" />
                    <span>Requesting your ride…</span>
                  </>
                ) : fare ? (
                  <span>Request {selectedOption.label} · ₹{fare}</span>
                ) : (
                  <span>Request {selectedOption.label}</span>
                )}
              </button>

              {!user && (
                <p className="booking-login-note">
                  Plan your trip now — you’ll{' '}
                  <button type="button" onClick={onRequireAuth}>log in</button>{' '}
                  before paying.
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="panel-view" aria-labelledby="activity-title">
            <div className="panel-scroll">
              <div className="activity-header">
                <button
                  type="button"
                  className="panel-back"
                  onClick={() => setPanelView('ride')}
                  aria-label="Back to booking"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <h1 id="activity-title" className="panel-title">Activity</h1>
              </div>

              <div className="segmented" role="tablist" aria-label="Ride list">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!showHistory}
                  className={!showHistory ? 'active' : ''}
                  onClick={() => setShowHistory(false)}
                >
                  Upcoming ({activeRides.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={showHistory}
                  className={showHistory ? 'active' : ''}
                  onClick={() => setShowHistory(true)}
                >
                  Past ({historyRides.length})
                </button>
              </div>

              {ridesLoading ? (
                <div className="empty-rides">
                  <span className="spinner" aria-hidden="true" />
                  Loading your rides…
                </div>
              ) : ridesError ? (
                <p className="error-text">{ridesError}</p>
              ) : visibleRides.length === 0 ? (
                <div className="empty-rides">
                  <strong>{showHistory ? 'No past trips yet' : 'You have no upcoming rides'}</strong>
                  <p>
                    {showHistory
                      ? 'Completed and cancelled trips will show up here.'
                      : 'Where are you headed next?'}
                  </p>
                  {!showHistory && (
                    <button type="button" className="empty-cta" onClick={() => setPanelView('ride')}>
                      Book a ride
                    </button>
                  )}
                </div>
              ) : (
                <div className="ride-list">
                  {visibleRides.map((ride) => {
                    const isLive = ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED';
                    const vehicleLabel =
                      rideOptions.find((o) => o.type === asRideType(ride.vehicleType))?.label ?? 'Ride';

                    return (
                      <article
                        key={ride.id}
                        className={`customer-ride-card ${isLive ? 'is-live' : ''}`}
                      >
                        <div className="ride-card-main">
                          <span className="ride-vehicle-icon">
                            <RideIcon type={asRideType(ride.vehicleType)} />
                          </span>

                          <div className="ride-card-title">
                            <strong>{isLive ? getRideTitle(ride) : ride.dropoffLocation}</strong>
                            <span>
                              {formatRideTime(ride.scheduledAt)} · {vehicleLabel}
                            </span>
                          </div>

                          <strong className="ride-price">₹{ride.fare}</strong>
                        </div>

                        {isLive && (
                          <div className={`ride-progress ${getStatusClass(ride.status)}`} aria-hidden="true">
                            <span />
                          </div>
                        )}

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

                        <div className="ride-card-footer">
                          <span className={`status-pill ${getStatusClass(ride.status)}`}>
                            {formatStatus(ride.status)}
                          </span>
                          <span className="ride-message">{getCustomerRideMessage(ride)}</span>
                        </div>

                        {ride.status === 'CONFIRMED' && ride.driverId && (
                          <div className="driver-preview">
                            <span className="driver-avatar" aria-hidden="true">
                              <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.5" fill="currentColor" /><path d="M3.5 17c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5" fill="currentColor" /></svg>
                            </span>
                            <div>
                              <strong>Your driver is on the way</strong>
                              <span>Driver details will appear here</span>
                            </div>
                          </div>
                        )}

                        {ride.status === 'PENDING' && (
                          <button
                            type="button"
                            className="cancel-ride-button"
                            disabled={cancellingRideId === ride.id}
                            onClick={() => handleCancelRide(ride.id)}
                          >
                            {cancellingRideId === ride.id ? 'Cancelling…' : 'Cancel ride'}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Account modal */}
      {profileOpen && user && (
        <div
          className="profile-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProfile();
            }
          }}
        >
          <section
            className="customer-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-profile-title"
          >
            <div className="customer-profile-header">
              <h2 id="customer-profile-title">Account</h2>
              <button
                type="button"
                className="customer-profile-close"
                onClick={closeProfile}
                disabled={profileSaving}
                aria-label="Close account"
              >
                ×
              </button>
            </div>

            <div className="customer-profile-identity">
              <span className="customer-profile-avatar">{initial}</span>
              <div>
                <h3>{user.name || 'Customer'}</h3>
                <p>{user.email || 'Jhanvi Cars rider'}</p>
              </div>
            </div>

            <div className="customer-profile-quick-actions">
              <button
                type="button"
                onClick={() => {
                  closeProfile();
                  openActivity(true);
                }}
              >
                <strong>Trips</strong>
                <small>Ride history</small>
              </button>
              <button type="button" disabled>
                <strong>Wallet · ₹0.00</strong>
                <small>Coming soon</small>
              </button>
              <button type="button" disabled>
                <strong>Security</strong>
                <small>Coming soon</small>
              </button>
            </div>

            <div className="customer-profile-section">
              <h3>Personal info</h3>

              <div className="customer-profile-field is-readonly">
                <span>Name</span>
                <strong>{user.name || 'Not available'}</strong>
              </div>

              <label className="customer-profile-field">
                <span>Email</span>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  disabled={profileSaving}
                  autoComplete="email"
                />
              </label>

              <label className="customer-profile-field">
                <span>Mobile number</span>
                <input
                  type="tel"
                  value={profileMobile}
                  onChange={(event) =>
                    setProfileMobile(
                      event.target.value.replace(/\D/g, '').slice(0, 10),
                    )
                  }
                  disabled={profileSaving}
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                />
              </label>
            </div>

            {profileError && (
              <p className="error-text" role="alert">{profileError}</p>
            )}

            {profileSuccess && (
              <p className="success-text" role="status">{profileSuccess}</p>
            )}

            <div className="customer-profile-footer">
              <button
                type="button"
                className="customer-profile-cancel"
                onClick={closeProfile}
                disabled={profileSaving}
              >
                Close
              </button>

              <button
                type="button"
                className="customer-profile-save"
                onClick={handleProfileSave}
                disabled={profileSaving}
              >
                {profileSaving ? (
                  <>
                    <span className="book-spinner" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
