import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import poisFixtureRaw from '@intown/contracts/fixtures/brain-slice/pois.json';
import geoFixtureRaw from '@intown/contracts/fixtures/brain-slice/geo-observations.json';
import {
  createAdminPool,
  insertObs,
  offsetLat,
  PORTO_LAT,
  PORTO_LNG,
  readPoi,
  resetBrain,
  seedCity,
  seedPoi,
} from './helpers/brain.ts';

/**
 * P08 AC4 + AC5 — the geo-consensus recompute + display gate (§5.5, D52/D53).
 * The AFTER-STATEMENT trigger recomputes on each insert, so every case seeds a
 * coord-less POI, appends observations, and reads back the derived pois row.
 *
 * DOCTRINE UNDER TEST:
 *   - 'verified' iff >= 2 INDEPENDENT sources (distinct source_kind) agree within
 *     100 m of the weighted centroid; otherwise 'approximate' (or 'unverified'
 *     with no eligible obs).
 *   - google_fallback is NEVER canonical: excluded from centroid/agreement, and
 *     its stored provenance is never relabelled (AC5).
 *   - expired observations are excluded from consensus even before a purge; the
 *     purge is the one sanctioned deletion path and re-arms the append-only guard.
 */

interface PoiFixtureRow {
  id: string;
  city_id: string;
  name: string;
  category: string;
  indoor_outdoor: string;
}
interface GeoFixtureRow {
  id: string;
  poi_id: string;
  source_kind: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  observed_at: string;
  expires_at: string | null;
  confidence: number;
}
const poisFixture = poisFixtureRaw as unknown as PoiFixtureRow[];
const geoFixture = geoFixtureRaw as unknown as GeoFixtureRow[];
const FIXTURE_CITY_ID = 'c0a70000-0000-4000-8000-000000000001';
const LELLO_ID = 'f0000000-0000-4000-8000-000000000001';

describe('Brain geo-consensus — recompute + display gate (AC4/AC5)', () => {
  const admin = createAdminPool();
  let cityId: string;

  beforeEach(async () => {
    await resetBrain(admin);
    cityId = await seedCity(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it('AC4.1: two independent sources 30 m apart → verified / cross_referenced', async () => {
    const poiId = await seedPoi(admin, { cityId });
    const lat2 = PORTO_LAT + offsetLat(30);
    await insertObs(admin, {
      poiId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });
    await insertObs(admin, {
      poiId,
      sourceKind: 'wikidata',
      lat: lat2,
      lng: PORTO_LNG,
      accuracyM: 12,
      confidence: 0.85,
    });

    const poi = await readPoi(admin, poiId);
    expect(poi.coord_resolution).toBe('verified');
    expect(poi.coord_verified_by).toBe('cross_referenced');
    expect(poi.lat).not.toBeNull();
    expect(poi.lng).not.toBeNull();
    expect(poi.coord_confidence).not.toBeNull();
    expect(poi.coord_confidence!).toBeGreaterThan(0);
    // Weighted centroid lies strictly between the two observation latitudes.
    expect(poi.lat!).toBeGreaterThan(PORTO_LAT);
    expect(poi.lat!).toBeLessThan(lat2);
    expect(poi.lng!).toBeCloseTo(PORTO_LNG, 6);
  });

  it('AC4.2: a single osm observation → approximate / open_data (non-navigable)', async () => {
    const poiId = await seedPoi(admin, { cityId });
    await insertObs(admin, {
      poiId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });

    const poi = await readPoi(admin, poiId);
    expect(poi.coord_resolution).toBe('approximate');
    expect(poi.coord_verified_by).toBe('open_data');
    expect(poi.lat).not.toBeNull();
    expect(poi.lat!).toBeCloseTo(PORTO_LAT, 5);
  });

  it('AC4.3: two SAME-source (osm+osm) obs within 100 m → still approximate (independence = distinct source_kind)', async () => {
    const poiId = await seedPoi(admin, { cityId });
    await insertObs(admin, {
      poiId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });
    await insertObs(admin, {
      poiId,
      sourceKind: 'osm',
      lat: PORTO_LAT + offsetLat(40),
      lng: PORTO_LNG,
      accuracyM: 6,
      confidence: 0.88,
    });

    const poi = await readPoi(admin, poiId);
    expect(poi.coord_resolution).toBe('approximate');
    expect(poi.coord_verified_by).toBe('open_data');
  });

  it('AC4.4: two independent sources ~500 m apart → NOT verified (no agreement within 100 m)', async () => {
    const poiId = await seedPoi(admin, { cityId });
    await insertObs(admin, {
      poiId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });
    await insertObs(admin, {
      poiId,
      sourceKind: 'wikidata',
      lat: PORTO_LAT + offsetLat(500),
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });

    const poi = await readPoi(admin, poiId);
    expect(poi.coord_resolution).toBe('approximate');
  });

  it('AC4.5: zero eligible observations → unverified, coord null', async () => {
    const poiId = await seedPoi(admin, { cityId });
    // No observations inserted; explicitly exercise the ungrounded recompute branch.
    await admin.query(`SELECT poi_recompute_coord($1)`, [poiId]);

    const poi = await readPoi(admin, poiId);
    expect(poi.coord_resolution).toBe('unverified');
    expect(poi.lat).toBeNull();
    expect(poi.lng).toBeNull();
    expect(poi.coord_confidence).toBeNull();
    expect(poi.coord_verified_by).toBeNull();
  });

  it('AC4.6: a lone first_traveler_gps observation → approximate / first_traveler_gps', async () => {
    const poiId = await seedPoi(admin, { cityId });
    await insertObs(admin, {
      poiId,
      sourceKind: 'first_traveler_gps',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 18,
      confidence: 0.8,
    });

    const poi = await readPoi(admin, poiId);
    expect(poi.coord_resolution).toBe('approximate');
    expect(poi.coord_verified_by).toBe('first_traveler_gps');
    expect(poi.lat).not.toBeNull();
  });

  it('AC5: a google_fallback obs is excluded from consensus and never relabelled', async () => {
    const poiId = await seedPoi(admin, { cityId });
    // Verify via osm + wikidata 30 m apart.
    await insertObs(admin, {
      poiId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });
    await insertObs(admin, {
      poiId,
      sourceKind: 'wikidata',
      lat: PORTO_LAT + offsetLat(30),
      lng: PORTO_LNG,
      accuracyM: 12,
      confidence: 0.85,
    });
    const before = await readPoi(admin, poiId);
    expect(before.coord_resolution).toBe('verified');

    // A far-away, still-valid google_fallback obs must NOT move the canonical coord.
    await admin.query(
      `INSERT INTO poi_geo_observations
         (poi_id, source_kind, lat, lng, accuracy_m, observed_at, expires_at, confidence)
       VALUES ($1, 'google_fallback', $2, $3, 30, now(), now() + interval '30 days', 0.95)`,
      [poiId, PORTO_LAT + offsetLat(500), PORTO_LNG],
    );

    const after = await readPoi(admin, poiId);
    expect(after.coord_resolution).toBe(before.coord_resolution);
    expect(after.coord_verified_by).toBe(before.coord_verified_by);
    expect(after.lat!).toBeCloseTo(before.lat!, 9);
    expect(after.lng!).toBeCloseTo(before.lng!, 9);

    // Provenance is never relabelled — the stored row is still 'google_fallback'.
    const { rows } = await admin.query<{ source_kind: string }>(
      `SELECT source_kind FROM poi_geo_observations
        WHERE poi_id = $1 AND source_kind = 'google_fallback'`,
      [poiId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source_kind).toBe('google_fallback');
  });

  it('AC4: an expired google_fallback obs is excluded even before purge; poi_geo_purge_expired removes it and re-arms the guard', async () => {
    const poiId = await seedPoi(admin, { cityId });
    // Non-expiring osm obs (the only eligible source).
    await insertObs(admin, {
      poiId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });
    // A google_fallback obs, far away, ALREADY expired.
    await admin.query(
      `INSERT INTO poi_geo_observations
         (poi_id, source_kind, lat, lng, accuracy_m, observed_at, expires_at, confidence)
       VALUES ($1, 'google_fallback', $2, $3, 30, now() - interval '40 days',
               now() - interval '10 days', 0.95)`,
      [poiId, PORTO_LAT + offsetLat(500), PORTO_LNG],
    );

    // Even with the expired row physically present, consensus reflects only the osm obs.
    const preState = await readPoi(admin, poiId);
    expect(preState.coord_resolution).toBe('approximate');
    expect(preState.coord_verified_by).toBe('open_data');
    expect(preState.lat!).toBeCloseTo(PORTO_LAT, 5);

    // Purge as superuser: returns >= 1, drops the expired row, keeps the osm row.
    const { rows: purged } = await admin.query<{ n: number }>(
      `SELECT poi_geo_purge_expired() AS n`,
    );
    expect(purged[0]!.n).toBeGreaterThanOrEqual(1);

    const { rows: remaining } = await admin.query<{ source_kind: string }>(
      `SELECT source_kind FROM poi_geo_observations WHERE poi_id = $1`,
      [poiId],
    );
    expect(remaining.map((r) => r.source_kind)).toEqual(['osm']);

    // POI recomputed post-purge (still approximate from the surviving osm obs).
    const postState = await readPoi(admin, poiId);
    expect(postState.coord_resolution).toBe('approximate');
    expect(postState.lat!).toBeCloseTo(PORTO_LAT, 5);

    // The append-only guard is re-armed: a direct DELETE / UPDATE of the surviving
    // (non-expired) row still raises.
    await expect(
      admin.query(`DELETE FROM poi_geo_observations WHERE poi_id = $1`, [poiId]),
    ).rejects.toThrow(/append-only/);
    await expect(
      admin.query(`UPDATE poi_geo_observations SET confidence = 0.1 WHERE poi_id = $1`, [poiId]),
    ).rejects.toThrow(/append-only/);
  });

  it('AC4 fixture replay: Livraria Lello (2 independent in-window obs) ends verified', async () => {
    await seedCity(admin, { id: FIXTURE_CITY_ID });
    for (const p of poisFixture) {
      await seedPoi(admin, {
        cityId: p.city_id,
        id: p.id,
        name: p.name,
        category: p.category,
        indoorOutdoor: p.indoor_outdoor,
      });
    }
    for (const o of geoFixture) {
      await insertObs(admin, {
        poiId: o.poi_id,
        sourceKind: o.source_kind,
        lat: o.lat,
        lng: o.lng,
        accuracyM: o.accuracy_m,
        observedAt: o.observed_at,
        expiresAt: o.expires_at,
        confidence: o.confidence,
      });
    }

    const lello = await readPoi(admin, LELLO_ID);
    expect(lello.coord_resolution).toBe('verified');
    expect(lello.coord_verified_by).toBe('cross_referenced');
    expect(lello.lat!).toBeCloseTo(41.14663, 3);
    expect(lello.lng!).toBeCloseTo(-8.61479, 3);
  });
});
