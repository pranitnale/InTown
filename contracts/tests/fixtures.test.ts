import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  Poi,
  Fact,
  PoiGeoObservation,
  TripPlace,
  PlanRevision,
  Stop,
  User,
  TravelerProfile,
  TasteProfile,
  Consent,
  Trip,
  TripMember,
  TripInvite,
} from '../types/index.ts';
import { ResearchStreamMessage, SolverRequest, SolverResponse } from '../api/index.ts';

/**
 * Golden-fixture contract test. Every fixture family is parsed with the zod
 * schema it is meant to satisfy — the honesty check that keeps the mock data in
 * lockstep with the frozen contract (§18.3, P00 AC #5). All six families are
 * enumerated explicitly so a missing / renamed fixture file fails loudly.
 */

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${rel}`, import.meta.url)), 'utf8'));

describe('fixtures: brain-slice', () => {
  it('pois.json validates as Poi[]', () => {
    const pois = z.array(Poi).parse(read('brain-slice/pois.json'));
    expect(pois.length).toBeGreaterThanOrEqual(8);
    expect(pois.some((p) => p.coord === null && p.coord_resolution === 'unverified')).toBe(true);
    expect(pois.some((p) => p.coord_verified_by === 'first_traveler_gps')).toBe(true);
  });

  it('facts.json validates as Fact[]', () => {
    const facts = z.array(Fact).parse(read('brain-slice/facts.json'));
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((f) => f.entity_kind === 'city')).toBe(true);
    expect(facts.some((f) => f.status === 'superseded')).toBe(true);
  });

  it('geo-observations.json validates as PoiGeoObservation[] with a ToS-limited (expiring) observation', () => {
    const obs = z.array(PoiGeoObservation).parse(read('brain-slice/geo-observations.json'));
    expect(obs.length).toBeGreaterThan(0);
    expect(obs.some((o) => o.expires_at !== null)).toBe(true);
    expect(obs.some((o) => o.expires_at === null)).toBe(true);
  });
});

describe('fixtures: longlist', () => {
  it('longlist.json validates as TripPlace[] with varied states', () => {
    const places = z.array(TripPlace).parse(read('longlist.json'));
    expect(places.length).toBeGreaterThanOrEqual(30);
    const states = new Set(places.map((p) => p.state));
    expect(states.has('must_do')).toBe(true);
    expect(states.has('suggested')).toBe(true);
  });
});

describe('fixtures: plan-3day', () => {
  it('plan-3day.json validates as a plan_revision + Stop[] over 3 days', () => {
    const data = read('plan-3day.json') as { plan_revision: unknown; stops: unknown };
    PlanRevision.parse(data.plan_revision);
    const stops = z.array(Stop).parse(data.stops);
    const days = new Set(stops.map((s) => s.day_index));
    expect([...days].sort()).toEqual([0, 1, 2]);
    expect(stops.some((s) => s.stop_kind === 'meal')).toBe(true);
    expect(stops.some((s) => s.poi_id === null)).toBe(true);
  });
});

describe('fixtures: profiles-trip-members', () => {
  it('profiles-trip-members.json validates every member entity', () => {
    const data = read('profiles-trip-members.json') as Record<string, unknown>;
    z.array(User).parse(data.users);
    z.array(TravelerProfile).parse(data.traveler_profiles);
    z.array(TasteProfile).parse(data.taste_profiles);
    z.array(Consent).parse(data.consents);
    Trip.parse(data.trip);
    const members = z.array(TripMember).parse(data.members);
    TripInvite.parse(data.invite);
    expect(members.some((m) => m.role === 'owner')).toBe(true);
  });
});

describe('fixtures: sse-research-stream', () => {
  it('sse-research-stream.json validates as an ordered ResearchStreamMessage[]', () => {
    const stream = z.array(ResearchStreamMessage).parse(read('sse-research-stream.json'));
    expect(stream[0]?.type).toBe('stage_started');
    expect(stream.at(-1)?.type).toBe('research_completed');
    // §5.5: no coordinate is ever streamed.
    for (const msg of stream) {
      expect(msg).not.toHaveProperty('lat');
      expect(msg).not.toHaveProperty('lng');
      expect(msg).not.toHaveProperty('coord');
    }
  });
});

describe('fixtures: solver', () => {
  it('request.json validates as SolverRequest', () => {
    const req = SolverRequest.parse(read('solver/request.json'));
    expect(req.candidates.some((c) => c.must_do)).toBe(true);
  });

  it('response.json validates as SolverResponse', () => {
    const res = SolverResponse.parse(read('solver/response.json'));
    expect(res.status).toBe('optimal');
    expect(res.days.length).toBeGreaterThan(0);
  });
});
