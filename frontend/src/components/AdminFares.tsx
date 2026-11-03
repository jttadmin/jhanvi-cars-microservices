import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getFareRules, updateFareRule } from '../api/fares';
import {
  DEFAULT_FARE_RULES,
  estimateFare,
  rulesByType,
  type FareRule,
  type RideType,
} from '../utils/fare';

const CATEGORIES: { type: RideType; label: string; hint: string }[] = [
  { type: 'AUTO', label: 'Auto', hint: 'Auto rickshaw' },
  { type: 'ECONOMY', label: 'Economy', hint: 'Cabs costing up to ₹10 lakh' },
  { type: 'COMFORT', label: 'Comfort', hint: 'Cabs costing ₹10–15 lakh' },
  { type: 'COMFORT_PLUS', label: 'Comfort Plus', hint: 'Cabs costing above ₹15 lakh' },
];

type Draft = Record<keyof Omit<FareRule, 'vehicleType' | 'updatedBy' | 'updatedAt'>, string>;

const toDraft = (rule: FareRule): Draft => ({
  minFare: String(rule.minFare),
  minKm: String(rule.minKm),
  perKm: String(rule.perKm),
  nightStart: rule.nightStart,
  nightEnd: rule.nightEnd,
  nightSurchargePercent: String(rule.nightSurchargePercent),
  gstPercent: String(rule.gstPercent),
  source: rule.source ?? '',
});

const fromDraft = (type: RideType, d: Draft): FareRule => ({
  vehicleType: type,
  minFare: Number(d.minFare),
  minKm: Number(d.minKm),
  perKm: Number(d.perKm),
  nightStart: d.nightStart,
  nightEnd: d.nightEnd,
  nightSurchargePercent: Number(d.nightSurchargePercent),
  gstPercent: Number(d.gstPercent),
  source: d.source.trim() || null,
});

const inr = (v: number) => `₹${v.toLocaleString('en-IN')}`;
const DAY = new Date('2026-01-01T14:00:00+05:30');
const NIGHT = new Date('2026-01-01T01:00:00+05:30');

export default function AdminFares() {
  const [rules, setRules] = useState<Record<RideType, FareRule>>(DEFAULT_FARE_RULES);
  const [drafts, setDrafts] = useState<Record<RideType, Draft>>(() =>
    Object.fromEntries(CATEGORIES.map(({ type }) => [type, toDraft(DEFAULT_FARE_RULES[type])])) as Record<RideType, Draft>,
  );
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<RideType | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getFareRules()
      .then((list) => {
        const map = rulesByType(list);
        setRules(map);
        setDrafts(Object.fromEntries(CATEGORIES.map(({ type }) => [type, toDraft(map[type])])) as Record<RideType, Draft>);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load fares.'))
      .finally(() => setLoading(false));
  }, []);

  const setField = (type: RideType, field: keyof Draft, value: string) =>
    setDrafts((current) => ({ ...current, [type]: { ...current[type], [field]: value } }));

  async function save(type: RideType) {
    setSavingType(type);
    setError('');
    setNotice('');
    try {
      const { vehicleType: _t, ...input } = fromDraft(type, drafts[type]);
      const saved = await updateFareRule(type, input);
      setRules((current) => ({ ...current, [type]: saved }));
      setDrafts((current) => ({ ...current, [type]: toDraft(saved) }));
      setNotice(`${CATEGORIES.find((c) => c.type === type)?.label} fares saved. New bookings use them straight away.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save fares.');
    } finally {
      setSavingType(null);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Fares</h2>
          <p>
            Rates follow the government-notified fares for each category. Update them here when the
            government revises rates. Every new booking is priced on the server from these values.
          </p>
        </div>
      </div>

      {error && <div className="admin-feedback admin-feedback-error" role="alert">{error}</div>}
      {notice && <div className="admin-feedback admin-feedback-success" role="status">{notice}</div>}

      {loading ? (
        <p className="admin-loading">Loading fares…</p>
      ) : (
        CATEGORIES.map(({ type, label, hint }) => {
          const d = drafts[type];
          const preview = fromDraft(type, d);
          const dirty = JSON.stringify(toDraft(rules[type])) !== JSON.stringify(d);
          const valid =
            [d.minFare, d.minKm, d.perKm, d.nightSurchargePercent, d.gstPercent].every(
              (v) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0,
            ) && /^\d{2}:\d{2}$/.test(d.nightStart) && /^\d{2}:\d{2}$/.test(d.nightEnd);

          return (
            <form
              key={type}
              className="admin-vehicle-form admin-fare-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save(type);
              }}
            >
              <div className="admin-form-heading admin-fare-heading">
                <div>
                  <strong>{label}</strong>
                  <span>{hint}</span>
                </div>
                {valid && (
                  <span className="admin-fare-example">
                    10 km: <b>{inr(estimateFare({ distanceKm: 10 }, type, { [type]: preview }, DAY))}</b> by day ·{' '}
                    <b>{inr(estimateFare({ distanceKm: 10 }, type, { [type]: preview }, NIGHT))}</b> at 1 am
                  </span>
                )}
              </div>

              <label>Minimum fare (₹)<input required type="number" min="0" step="0.5" value={d.minFare} onChange={(e) => setField(type, 'minFare', e.target.value)} /></label>
              <label>Covers first (km)<input required type="number" min="0" step="0.5" value={d.minKm} onChange={(e) => setField(type, 'minKm', e.target.value)} /></label>
              <label>Per km after that (₹)<input required type="number" min="0" step="0.5" value={d.perKm} onChange={(e) => setField(type, 'perKm', e.target.value)} /></label>
              <label>Night from<input required type="time" value={d.nightStart} onChange={(e) => setField(type, 'nightStart', e.target.value)} /></label>
              <label>Night until<input required type="time" value={d.nightEnd} onChange={(e) => setField(type, 'nightEnd', e.target.value)} /></label>
              <label>Night surcharge (%)<input required type="number" min="0" max="100" step="1" value={d.nightSurchargePercent} onChange={(e) => setField(type, 'nightSurchargePercent', e.target.value)} /></label>
              <label>GST (%)<input required type="number" min="0" max="28" step="0.5" value={d.gstPercent} onChange={(e) => setField(type, 'gstPercent', e.target.value)} /></label>
              <label className="admin-fare-source">Government order / source<input maxLength={255} value={d.source} onChange={(e) => setField(type, 'source', e.target.value)} placeholder="e.g. Karnataka transport dept order, Feb 2024" /></label>

              <div className="admin-form-actions">
                <button className="admin-primary-button" type="submit" disabled={!dirty || !valid || savingType !== null}>
                  {savingType === type ? 'Saving…' : 'Save fares'}
                </button>
                {dirty && (
                  <button className="admin-secondary-button" type="button" disabled={savingType !== null} onClick={() => setDrafts((c) => ({ ...c, [type]: toDraft(rules[type]) }))}>
                    Discard changes
                  </button>
                )}
                {rules[type].updatedAt && (
                  <span className="admin-muted admin-fare-updated">
                    Last updated {new Date(rules[type].updatedAt as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            </form>
          );
        })
      )}
    </section>
  );
}
