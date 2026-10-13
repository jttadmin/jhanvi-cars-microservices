import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
} from '../api/client';
import {
  createAdminVehicle,
  getAdminDrivers,
  getAdminVehicles,
  updateAdminVehicle,
  updateAdminVehicleStatus,
} from '../api/admin';
import type {
  AdminDriver,
  AdminVehicle,
  VehicleStatus,
  VehicleType,
} from '../api/admin';
import { getAdminBookings, updateAdminBookingStatus } from '../api/adminBookings';
import type { AdminBooking, BookingStatus } from '../api/adminBookings';
import { getAdminPayments } from '../api/adminPayments';
import type { AdminPayment, PaymentStatus } from '../api/adminPayments';
import './AdminDashboard.css';

type Tab = 'overview' | 'vehicles' | 'drivers' | 'bookings' | 'payments';

const VEHICLE_TYPES: VehicleType[] = [
  'AUTO', 'SEDAN', 'SUV', 'HATCHBACK', 'LUXURY', 'MUV',
];

const VEHICLE_STATUSES: VehicleStatus[] = [
  'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE',
];

const emptyForm = {
  registrationNumber: '',
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  type: 'SEDAN' as VehicleType,
  driverId: '',
};

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export default function AdminDashboard({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [bookingFilter, setBookingFilter] = useState<"ALL" | BookingStatus>("ALL");
  const [bookingSavingId, setBookingSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<AdminVehicle | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      getAdminVehicles(),
      getAdminDrivers(),
      getAdminBookings(),
      getAdminPayments(),
    ]);

    const failures: string[] = [];

    if (results[0].status === "fulfilled") setVehicles(results[0].value);
    else failures.push(`Vehicles: ${messageOf(results[0].reason)}`);

    if (results[1].status === "fulfilled") setDrivers(results[1].value);
    else failures.push(`Drivers: ${messageOf(results[1].reason)}`);

    if (results[2].status === "fulfilled") setBookings(results[2].value);
    else failures.push(`Bookings: ${messageOf(results[2].reason)}`);

    if (results[3].status === "fulfilled") setPayments(results[3].value);
    else failures.push(`Payments: ${messageOf(results[3].reason)}`);

    if (failures.length) setError(failures.join(" | "));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const assignedDriverIds = useMemo(
    () => new Set(vehicles.map((v) => v.driverId).filter(
      (id): id is string => Boolean(id),
    )),
    [vehicles],
  );

  const driverNames = useMemo(
    () => new Map(drivers.map((d) => [d.id, d.name])),
    [drivers],
  );

  const availableDrivers = useMemo(
    () => drivers.filter((d) => !assignedDriverIds.has(d.id)),
    [drivers, assignedDriverIds],
  );

  const editAvailableDrivers = useMemo(
    () =>
      editingVehicle
        ? drivers.filter(
            (d) =>
              !assignedDriverIds.has(d.id) ||
              d.id === editingVehicle.driverId,
          )
        : availableDrivers,
    [drivers, assignedDriverIds, editingVehicle, availableDrivers],
  );

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.registrationNumber, v.make, v.model, v.type, v.status,
        driverNames.get(v.driverId ?? '') ?? '']
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [vehicles, query, driverNames]);

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) =>
      [d.name, d.email, d.phone, d.licenseNumber, d.vehicleNumber,
        d.vehicleModel]
        .some((value) => (value ?? '').toLowerCase().includes(q)),
    );
  }, [drivers, query]);

  async function handleCreateVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createAdminVehicle({
        registrationNumber: form.registrationNumber.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        type: form.type,
        driverId: form.driverId || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Vehicle registered successfully.');
      await loadData();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditingVehicle(vehicle: AdminVehicle) {
    setEditingVehicle(vehicle);
    setShowForm(false);
    setForm({
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: String(vehicle.year),
      type: vehicle.type,
      driverId: vehicle.driverId ?? '',
    });
    setError('');
    setNotice('');
  }

  async function handleUpdateVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVehicle) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const updated = await updateAdminVehicle(editingVehicle.id, {
        registrationNumber: form.registrationNumber.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        type: form.type,
        driverId: form.driverId || null,
      });

      setVehicles((current) =>
        current.map((vehicle) => vehicle.id === updated.id ? updated : vehicle),
      );
      setEditingVehicle(null);
      setForm(emptyForm);
      setNotice(`Vehicle ${updated.registrationNumber} updated successfully.`);
      await loadData();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(vehicle: AdminVehicle, status: VehicleStatus) {
    setError('');
    setNotice('');
    try {
      const updated = await updateAdminVehicleStatus(vehicle.id, status);
      setVehicles((current) => current.map((v) => v.id === updated.id ? updated : v));
      setNotice(`Status updated for ${vehicle.registrationNumber}.`);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function openTab(tab: Tab) {
    setActiveTab(tab);
    setQuery('');
    setError('');
    setNotice('');
  }

  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesStatus = bookingFilter === "ALL" || booking.status === bookingFilter;
      const matchesQuery = !q || [
        booking.id, booking.userId, booking.driverId ?? "",
        booking.pickupLocation, booking.dropoffLocation, booking.status,
      ].some((value) => value.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [bookings, bookingFilter, query]);

  async function handleBookingStatusChange(booking: AdminBooking, status: BookingStatus) {
    setError("");
    setNotice("");
    setBookingSavingId(booking.id);
    try {
      const updated = await updateAdminBookingStatus(booking.id, status);
      setBookings((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Booking ${booking.id.slice(0, 8)} updated to ${status}.`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBookingSavingId(null);
    }
  }

  function allowedBookingStatuses(status: BookingStatus): BookingStatus[] {
    if (status === "PENDING") return ["CONFIRMED", "CANCELLED"];
    if (status === "CONFIRMED") return ["ONGOING", "CANCELLED"];
    if (status === "ONGOING") return ["COMPLETED"];
    return [];
  }

  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesStatus = paymentFilter === "ALL" || payment.status === paymentFilter;
      const matchesQuery = !q || [
        payment.id, payment.bookingId, payment.userId,
        payment.transactionId ?? "", payment.method, payment.status,
      ].some((value) => value.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [payments, paymentFilter, query]);

  const paidTotalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    payments.filter((p) => p.status === "PAID").forEach((p) => {
      const currency = p.currency || "INR";
      totals.set(currency, (totals.get(currency) ?? 0) + p.amount);
    });
    return totals;
  }, [payments]);

  const refundedTotalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    payments.filter((p) => p.status === "REFUNDED").forEach((p) => {
      const currency = p.currency || "INR";
      totals.set(currency, (totals.get(currency) ?? 0) + p.amount);
    });
    return totals;
  }, [payments]);

  const formatCurrencyTotals = (totals: Map<string, number>) => {
    if (totals.size === 0) return "—";
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => {
        try {
          return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 2,
          }).format(amount);
        } catch {
          return `${currency} ${amount.toFixed(2)}`;
        }
      })
      .join(" · ");
  };

  const assignedCount = vehicles.filter((v) => v.driverId).length;
  const availableCount = vehicles.filter((v) => v.status === 'AVAILABLE').length;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">J</span>
          <div><strong>JHANVI CARS</strong><small>Fleet administration</small></div>
        </div>
        <p className="admin-nav-label">WORKSPACE</p>
        <button className={activeTab === 'overview' ? 'admin-nav active' : 'admin-nav'} onClick={() => openTab('overview')}><span>◫</span> Overview</button>
        <button className={activeTab === 'vehicles' ? 'admin-nav active' : 'admin-nav'} onClick={() => openTab('vehicles')}><span>▣</span> Vehicles</button>
        <button className={activeTab === 'drivers' ? 'admin-nav active' : 'admin-nav'} onClick={() => openTab('drivers')}><span>♙</span> Drivers</button>
        <button className={activeTab === 'bookings' ? 'admin-nav active' : 'admin-nav'} onClick={() => openTab('bookings')}><span>▤</span> Bookings</button>
        <button className={activeTab === 'payments' ? 'admin-nav active' : 'admin-nav'} onClick={() => openTab('payments')}><span>₹</span> Payments</button>
        <div className="admin-sidebar-bottom">
          <span className="admin-avatar">A</span>
          <div className="admin-account"><strong>Administrator</strong><small>Fleet manager</small></div>
          <button
            type="button"
            className="admin-logout"
            onClick={onLogout}
            title="Log out"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">JHANVI CARS / ADMIN</span>
            <h1>{activeTab === 'overview' ? 'Fleet overview' : activeTab === 'vehicles' ? 'Vehicle management' : activeTab === 'drivers' ? 'Driver management' : activeTab === 'bookings' ? 'Booking management' : 'Payment management'}</h1>
          </div>
          <button type="button" className="admin-refresh" onClick={() => void loadData()} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </header>

        {error && <div className="admin-feedback admin-feedback-error" role="alert">{error}</div>}
        {notice && <div className="admin-feedback admin-feedback-success" role="status">{notice}</div>}

        {activeTab === 'overview' && (
          <>
            <section className="admin-welcome">
              <div><span className="admin-eyebrow">OPERATIONS CENTER</span><h2>Your fleet, at a glance.</h2><p>Manage your drivers and vehicles from one place.</p></div>
              <div className="admin-welcome-art" aria-hidden="true">↗</div>
            </section>
            <section className="admin-stats">
              <article className="admin-stat-card"><span className="admin-stat-icon">♙</span><p>Registered drivers</p><strong>{loading ? '…' : drivers.length}</strong><small>From driver service</small></article>
              <article className="admin-stat-card"><span className="admin-stat-icon">▣</span><p>Total vehicles</p><strong>{loading ? '…' : vehicles.length}</strong><small>Registered fleet</small></article>
              <article className="admin-stat-card"><span className="admin-stat-icon">✓</span><p>Assigned vehicles</p><strong>{loading ? '…' : assignedCount}</strong><small>With a driver ID</small></article>
              <article className="admin-stat-card"><span className="admin-stat-icon">＋</span><p>Available vehicles</p><strong>{loading ? '…' : availableCount}</strong><small>Status marked available</small></article>
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Booking operations</h2><p>Live booking and payment-service records.</p></div></div>
              <section className="admin-stats">
                <article className="admin-stat-card"><span className="admin-stat-icon">▤</span><p>Total bookings</p><strong>{bookings.length}</strong><small>All booking statuses</small></article>
                <article className="admin-stat-card"><span className="admin-stat-icon">✓</span><p>Completed bookings</p><strong>{bookings.filter((b) => b.status === "COMPLETED").length}</strong><small>{bookings.length ? `${Math.round(bookings.filter((b) => b.status === "COMPLETED").length / bookings.length * 100)}% of recorded bookings` : "No bookings recorded"}</small></article>
                <article className="admin-stat-card"><span className="admin-stat-icon">◷</span><p>Active bookings</p><strong>{bookings.filter((b) => b.status === "CONFIRMED" || b.status === "ONGOING").length}</strong><small>Confirmed or ongoing</small></article>
                <article className="admin-stat-card"><span className="admin-stat-icon">↩</span><p>Cancelled bookings</p><strong>{bookings.filter((b) => b.status === "CANCELLED").length}</strong><small>Recorded cancellations</small></article>
              </section>
              <div className="admin-setup-row"><span className="admin-setup-number">03</span><div><strong>Payment records</strong><p>{payments.length} payments · {payments.filter((p) => p.status === "PAID").length} marked paid · {payments.filter((p) => p.status === "FAILED").length} failed.</p></div><button onClick={() => openTab("payments")}>View payments →</button></div>
              <div className="admin-setup-row"><span className="admin-setup-number">04</span><div><strong>Booking management</strong><p>Review reservations and perform permitted status transitions.</p></div><button onClick={() => openTab("bookings")}>View bookings →</button></div>
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Fleet setup</h2><p>Review driver records and manage vehicle assignments.</p></div></div>
              <div className="admin-setup-row"><span className="admin-setup-number">01</span><div><strong>Review your drivers</strong><p>View driver contact details and assignment information.</p></div><button onClick={() => openTab('drivers')}>View drivers →</button></div>
              <div className="admin-setup-row"><span className="admin-setup-number">02</span><div><strong>Manage your vehicles</strong><p>Register vehicles and review their current status.</p></div><button onClick={() => openTab('vehicles')}>Manage vehicles →</button></div>
            </section>
          </>
        )}

        {activeTab === 'vehicles' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div><h2>Vehicles</h2><p>{vehicles.length} vehicle record{vehicles.length === 1 ? '' : 's'} in the fleet.</p></div>
              <button type="button" className="admin-primary-button" onClick={() => { if (showForm || editingVehicle) { setShowForm(false); setEditingVehicle(null); setForm(emptyForm); } else { setShowForm(true); } setError(''); setNotice(''); }}>{showForm || editingVehicle ? 'Cancel editing' : '+ Register vehicle'}</button>
            </div>

            {(showForm || editingVehicle) && (
              <form className="admin-vehicle-form" onSubmit={editingVehicle ? handleUpdateVehicle : handleCreateVehicle}>
                {editingVehicle && <div className="admin-form-heading"><strong>Edit {editingVehicle.registrationNumber}</strong><span>Update details or change the driver assignment.</span></div>}
                <label>Registration number<input required minLength={3} maxLength={20} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="KA01AB1234" /></label>
                <label>Make<input required minLength={2} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Maruti Suzuki" /></label>
                <label>Model<input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Dzire" /></label>
                <label>Year<input required type="number" min="1900" max="2100" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
                <label>Vehicle type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VehicleType })}>{VEHICLE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                <label>Assign driver (optional)<select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}><option value="">Leave unassigned</option>{editAvailableDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} — {driver.phone}</option>)}</select></label>
                <div className="admin-form-actions">
                  <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingVehicle ? 'Save changes' : 'Save vehicle'}</button>
                  {editingVehicle && <button className="admin-secondary-button" type="button" disabled={saving} onClick={() => { setEditingVehicle(null); setForm(emptyForm); setError(''); }}>Cancel</button>}
                </div>
              </form>
            )}

            <div className="admin-search-row"><input aria-label="Search vehicles" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search registration, model, driver…" /><span>{filteredVehicles.length} results</span></div>
            {loading ? <p className="admin-loading">Loading vehicles…</p> : filteredVehicles.length === 0 ? <div className="admin-empty-state"><span>▣</span><h3>{vehicles.length ? 'No matching vehicles' : 'No vehicles registered yet'}</h3><p>{vehicles.length ? 'Try a different search.' : 'Register your first vehicle to start building the fleet.'}</p></div> : (
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Vehicle</th><th>Registration</th><th>Driver</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {filteredVehicles.map((vehicle) => <tr key={vehicle.id}><td><strong>{vehicle.make} {vehicle.model}</strong><small>{vehicle.year} · {vehicle.type}</small></td><td>{vehicle.registrationNumber}</td><td>{vehicle.driverId ? driverNames.get(vehicle.driverId) ?? `Driver ${vehicle.driverId.slice(0, 8)}` : <span className="admin-muted">Unassigned</span>}</td><td><select aria-label={`Status for ${vehicle.registrationNumber}`} value={vehicle.status} onChange={(e) => void handleStatusChange(vehicle, e.target.value as VehicleStatus)}>{VEHICLE_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></td><td><button type="button" className="admin-row-action" onClick={() => startEditingVehicle(vehicle)}>Edit / Assign</button></td></tr>)}
              </tbody></table></div>
            )}
          </section>
        )}

        {activeTab === 'drivers' && (
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><h2>Drivers</h2><p>{drivers.length} registered driver{drivers.length === 1 ? '' : 's'}.</p></div></div>
            <div className="admin-search-row"><input aria-label="Search drivers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone, licence…" /><span>{filteredDrivers.length} results</span></div>
            {loading ? <p className="admin-loading">Loading drivers…</p> : filteredDrivers.length === 0 ? <div className="admin-empty-state"><span>♙</span><h3>{drivers.length ? 'No matching drivers' : 'No drivers found'}</h3><p>{drivers.length ? 'Try a different search.' : 'Registered drivers will appear here.'}</p></div> : (
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Driver</th><th>Contact</th><th>Vehicle record</th><th>Fleet assignment</th><th>Availability</th></tr></thead><tbody>
                {filteredDrivers.map((driver) => {
                  const vehicle = vehicles.find((v) => v.driverId === driver.id);
                  return <tr key={driver.id}><td><strong>{driver.name}</strong><small>Licence: {driver.licenseNumber || '—'}</small></td><td>{driver.phone}<small>{driver.email}</small></td><td>{driver.vehicleNumber || '—'}<small>{driver.vehicleModel || driver.vehicleType || '—'}</small></td><td>{vehicle ? <><strong>{vehicle.registrationNumber}</strong><small>{vehicle.make} {vehicle.model}</small></> : <span className="admin-muted">No fleet assignment</span>}</td><td><span className={driver.isOnline ? 'admin-status admin-status-online' : 'admin-status'}>{driver.isOnline ? 'Online' : 'Offline'}</span><small>{driver.isAvailable ? 'Available for rides' : 'Not available'}</small></td></tr>;
                })}
              </tbody></table></div>
            )}
          </section>
        )}
        {activeTab === 'bookings' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>Bookings</h2>
                <p>{bookings.length} booking record{bookings.length === 1 ? '' : 's'}.</p>
              </div>
            </div>
            <div className="admin-search-row">
              <input aria-label="Search bookings" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search booking, customer, driver, location…" />
              <select aria-label="Filter bookings by status" value={bookingFilter} onChange={(e) => setBookingFilter(e.target.value as "ALL" | BookingStatus)}>
                <option value="ALL">All statuses</option>
                {(["PENDING", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"] as BookingStatus[]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <span>{filteredBookings.length} results</span>
            </div>
            {loading ? <p className="admin-loading">Loading bookings…</p> : filteredBookings.length === 0 ? (
              <div className="admin-empty-state"><span>▤</span><h3>{bookings.length ? "No matching bookings" : "No bookings found"}</h3><p>{bookings.length ? "Try another search or status filter." : "Bookings will appear here when customers create them."}</p></div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Booking</th><th>Customer / Driver</th><th>Journey</th><th>Schedule</th><th>Fare</th><th>Status / Action</th></tr></thead>
                  <tbody>
                    {filteredBookings.map((booking) => {
                      const nextStatuses = allowedBookingStatuses(booking.status);
                      const scheduledDate = new Date(booking.scheduledAt);
                      return (
                        <tr key={booking.id}>
                          <td><strong>{booking.id.slice(0, 8)}</strong><small>{booking.vehicleType ?? "Vehicle type not set"}</small></td>
                          <td><strong>{booking.userId.slice(0, 8)}</strong><small>{booking.driverId ? `Driver ${booking.driverId.slice(0, 8)}` : "Unassigned"}</small></td>
                          <td><strong>{booking.pickupLocation}</strong><small>To: {booking.dropoffLocation}</small></td>
                          <td>{Number.isNaN(scheduledDate.getTime()) ? booking.scheduledAt : scheduledDate.toLocaleString()}</td>
                          <td>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(booking.fare)}</td>
                          <td>
                            <strong>{statusLabel(booking.status)}</strong>
                            {nextStatuses.length > 0 && (
                              <select aria-label={`Update booking ${booking.id}`} value="" disabled={bookingSavingId === booking.id} onChange={(e) => { if (e.target.value) void handleBookingStatusChange(booking, e.target.value as BookingStatus); }}>
                                <option value="">{bookingSavingId === booking.id ? "Saving…" : "Change status…"}</option>
                                {nextStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'payments' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>Payments</h2>
                <p>{payments.length} payment record{payments.length === 1 ? '' : 's'} from the payment service.</p>
              </div>
            </div>
            <section className="admin-stats">
              <article className="admin-stat-card"><span className="admin-stat-icon">₹</span><p>Payments recorded as paid</p><strong>{formatCurrencyTotals(paidTotalsByCurrency)}</strong><small>PAID records grouped by currency</small></article>
              <article className="admin-stat-card"><span className="admin-stat-icon">↩</span><p>Payments recorded as refunded</p><strong>{formatCurrencyTotals(refundedTotalsByCurrency)}</strong><small>Sum of REFUNDED records</small></article>
              <article className="admin-stat-card"><span className="admin-stat-icon">▤</span><p>Total records</p><strong>{payments.length}</strong><small>All payment statuses</small></article>
            </section>
            <div className="admin-search-row">
              <input aria-label="Search payments" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payment, booking, customer, transaction…" />
              <select aria-label="Filter payments by status" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as "ALL" | PaymentStatus)}>
                <option value="ALL">All statuses</option>
                {(["PENDING", "AUTHORIZED", "PAID", "FAILED", "REFUNDED"] as PaymentStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <span>{filteredPayments.length} results</span>
            </div>
            {loading ? <p className="admin-loading">Loading payments…</p> : filteredPayments.length === 0 ? (
              <div className="admin-empty-state"><span>₹</span><h3>{payments.length ? "No matching payments" : "No payment records found"}</h3><p>{payments.length ? "Try another search or status filter." : "Payment records will appear here when payments are created."}</p></div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Payment</th><th>Booking / Customer</th><th>Transaction</th><th>Method</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
                  <tbody>
                    {filteredPayments.map((payment) => {
                      const paymentDate = payment.createdAt ? new Date(payment.createdAt) : null;
                      return (
                        <tr key={payment.id}>
                          <td><strong>{payment.id.slice(0, 8)}</strong></td>
                          <td><strong>{payment.bookingId.slice(0, 8)}</strong><small>Customer {payment.userId.slice(0, 8)}</small></td>
                          <td>{payment.transactionId || <span className="admin-muted">Not available</span>}</td>
                          <td>{payment.method}</td>
                          <td>{new Intl.NumberFormat("en-IN", { style: "currency", currency: payment.currency || "INR", maximumFractionDigits: 2 }).format(payment.amount)}</td>
                          <td><span className="admin-status">{payment.status}</span></td>
                          <td>{paymentDate && !Number.isNaN(paymentDate.getTime()) ? paymentDate.toLocaleString() : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
