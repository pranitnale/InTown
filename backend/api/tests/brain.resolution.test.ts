import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
 * P08 AC3 — entity resolution (§5.4 dedup, D23/D31). DB-level exercise of the
 * SQL cascade: (1) exact external-id lookup, (2) fuzzy name+category+geo matcher,
 * (3) below-threshold ⇒ caller creates an 'unverified' POI, and the merge/unmerge
 * machinery (source_refs/external_ids union, redirect, snapshot restore, group
 * coord recompute) — with facts left untouched on their original entity_id.
 */

describe('Brain resolution — external-id / fuzzy / merge (AC3)', () => {
  const admin = createAdminPool();
  let cityId: string;

  beforeEach(async () => {
    await resetBrain(admin);
    cityId = await seedCity(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  async function findByExternalId(
    city: string,
    key: string,
    value: string,
  ): Promise<string | null> {
    const { rows } = await admin.query<{ id: string | null }>(
      `SELECT poi_find_by_external_id($1, $2, $3) AS id`,
      [city, key, value],
    );
    return rows[0]!.id;
  }

  interface Candidate {
    poi_id: string;
    name_sim: number;
    dist_m: number | null;
    score: number;
  }
  async function matchCandidates(
    city: string,
    name: string,
    category: string,
    lat: number | null,
    lng: number | null,
  ): Promise<Candidate[]> {
    const { rows } = await admin.query<Candidate>(
      `SELECT * FROM poi_match_candidates($1, $2, $3, $4, $5)`,
      [city, name, category, lat, lng],
    );
    return rows;
  }

  it('AC3.1: external-id path — exact hit, wrong value, and merged-POI exclusion', async () => {
    const poiId = await seedPoi(admin, {
      cityId,
      name: 'Some Place',
      externalIds: { osm_id: 'node/123' },
    });

    expect(await findByExternalId(cityId, 'osm_id', 'node/123')).toBe(poiId);
    // Wrong value → null.
    expect(await findByExternalId(cityId, 'osm_id', 'node/999')).toBeNull();

    // Merge `poiId` into a fresh canonical POI: the id folds into `kept` (which had
    // no osm_id) and the now-merged POI is excluded from the lookup.
    const keptId = await seedPoi(admin, { cityId, name: 'Kept Place', externalIds: {} });
    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [keptId, poiId]);

    const resolved = await findByExternalId(cityId, 'osm_id', 'node/123');
    expect(resolved).toBe(keptId); // resolves to the canonical head…
    expect(resolved).not.toBe(poiId); // …never the merged duplicate.
  });

  it('AC3.2: fuzzy path — name+category+geo match, and category/geo/name misses', async () => {
    const lelloId = await seedPoi(admin, {
      cityId,
      name: 'Livraria Lello',
      category: 'SIGHT',
    });
    // Ground it with a single osm observation (coord set, resolution approximate).
    await insertObs(admin, {
      poiId: lelloId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });

    // Compatible category (SIGHT=SIGHT), similar name, ~50 m away → matches.
    const hit = await matchCandidates(
      cityId,
      'Livraria Lello & Irmão',
      'SIGHT',
      PORTO_LAT + offsetLat(50),
      PORTO_LNG,
    );
    expect(hit.map((r) => r.poi_id)).toContain(lelloId);
    const hitRow = hit.find((r) => r.poi_id === lelloId)!;
    expect(hitRow.score).toBeGreaterThan(0.45);
    expect(hitRow.dist_m!).toBeLessThanOrEqual(150);

    // Incompatible category (NIGHTLIFE vs SIGHT — not a compatible pair) → no row.
    const catMiss = await matchCandidates(
      cityId,
      'Livraria Lello & Irmão',
      'NIGHTLIFE',
      PORTO_LAT + offsetLat(50),
      PORTO_LNG,
    );
    expect(catMiss.map((r) => r.poi_id)).not.toContain(lelloId);

    // > 150 m away → geo gate fails → no row.
    const geoMiss = await matchCandidates(
      cityId,
      'Livraria Lello & Irmão',
      'SIGHT',
      PORTO_LAT + offsetLat(400),
      PORTO_LNG,
    );
    expect(geoMiss.map((r) => r.poi_id)).not.toContain(lelloId);

    // Dissimilar name (below the 0.45 trigram floor) → no row.
    const nameMiss = await matchCandidates(
      cityId,
      'Completely Unrelated Warehouse',
      'SIGHT',
      PORTO_LAT + offsetLat(50),
      PORTO_LNG,
    );
    expect(nameMiss.map((r) => r.poi_id)).not.toContain(lelloId);
  });

  it('AC3.3: below-threshold ⇒ caller creates a new POI flagged unverified (coord null)', async () => {
    // Seed a candidate that the probe will NOT match on name.
    await seedPoi(admin, { cityId, name: 'Livraria Lello', category: 'SIGHT' });

    const candidates = await matchCandidates(
      cityId,
      'Completely Unrelated Warehouse',
      'SIGHT',
      PORTO_LAT,
      PORTO_LNG,
    );
    expect(candidates).toHaveLength(0);

    // Caller creates a new POI — coord ungrounded, resolution defaults to unverified.
    const newId = await seedPoi(admin, {
      cityId,
      name: 'Completely Unrelated Warehouse',
      category: 'SIGHT',
    });
    const poi = await readPoi(admin, newId);
    expect(poi.coord_resolution).toBe('unverified');
    expect(poi.lat).toBeNull();
  });

  it('AC3.4: merge unions source_refs + external_ids (kept wins), redirects, journals, leaves facts in place; guards reject re-merge and self-merge', async () => {
    const keptRefs = [{ source_kind: 'osm', external_id: 'way/1' }];
    const mergedRefs = [{ source_kind: 'wikidata', external_id: 'Q2' }];
    const keptId = await seedPoi(admin, {
      cityId,
      name: 'Kept',
      externalIds: { osm_id: 'way/1', wikidata_id: 'Q1' },
      sourceRefs: keptRefs,
    });
    const mergedId = await seedPoi(admin, {
      cityId,
      name: 'Merged',
      externalIds: { wikidata_id: 'Q2', google_place_id: 'g2' },
      sourceRefs: mergedRefs,
    });

    // Facts appended against BOTH ids before the merge (append-only — never moved).
    await admin.query(
      `INSERT INTO facts (entity_kind, entity_id, attribute, value, source_kind, observed_at, confidence)
       VALUES ('poi', $1, 'a_kept', '1'::jsonb, 'osm', now(), 0.9),
              ('poi', $2, 'a_merged', '2'::jsonb, 'wikidata', now(), 0.9)`,
      [keptId, mergedId],
    );

    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [keptId, mergedId]);

    const kept = await readPoi(admin, keptId);
    const merged = await readPoi(admin, mergedId);

    // source_refs = union of both, deduped by whole element (distinct here → 2).
    const refs = kept.source_refs as Array<{ source_kind: string; external_id: string }>;
    expect(refs).toHaveLength(2);
    expect(refs).toEqual(expect.arrayContaining([...keptRefs, ...mergedRefs]));

    // external_ids = union, kept wins conflicts (wikidata_id stays Q1; g2 + way/1 added).
    expect(kept.external_ids).toEqual({
      osm_id: 'way/1',
      wikidata_id: 'Q1',
      google_place_id: 'g2',
    });

    // Redirect + journal.
    expect(merged.merged_into).toBe(keptId);
    const { rows: journal } = await admin.query<{ kept_snapshot: unknown; undone_at: string | null }>(
      `SELECT kept_snapshot, undone_at FROM poi_merges
        WHERE kept_poi_id = $1 AND merged_poi_id = $2`,
      [keptId, mergedId],
    );
    expect(journal).toHaveLength(1);
    expect(journal[0]!.undone_at).toBeNull();
    expect(journal[0]!.kept_snapshot).toEqual({
      source_refs: keptRefs,
      external_ids: { osm_id: 'way/1', wikidata_id: 'Q1' },
    });

    // Facts untouched on their original entity_id (never moved by the merge).
    const { rows: factRows } = await admin.query<{ entity_id: string; attribute: string }>(
      `SELECT entity_id, attribute FROM facts ORDER BY attribute`,
    );
    expect(factRows).toEqual([
      { entity_id: keptId, attribute: 'a_kept' },
      { entity_id: mergedId, attribute: 'a_merged' },
    ]);

    // Guard: re-merging an already-merged POI raises.
    await expect(
      admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [keptId, mergedId]),
    ).rejects.toThrow();
    // Guard: self-merge raises.
    await expect(
      admin.query(`SELECT poi_merge($1, $1, 'dup', 'test')`, [keptId]),
    ).rejects.toThrow();
  });

  it('AC3.4b: no-chain guard — cannot merge away a POI with incoming redirects; unmerge-first is the workaround', async () => {
    const aId = await seedPoi(admin, { cityId, name: 'A' });
    const bId = await seedPoi(admin, { cityId, name: 'B' });
    const cId = await seedPoi(admin, { cityId, name: 'C' });

    // B ← A: A now redirects to B (B is canonical).
    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [bId, aId]);
    expect((await readPoi(admin, aId)).merged_into).toBe(bId);

    // C ← B is refused: B has an incoming redirect (A→B), so folding B into C would
    // strand A one hop too deep (A→B→C). The no-chain guard RAISEs.
    await expect(
      admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [cId, bId]),
    ).rejects.toThrow(/incoming redirects|merge chain/);

    // C ← A is ALSO refused, but by the pre-existing already-merged guard: A was
    // already merged away, so its merged_into is non-null.
    await expect(
      admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [cId, aId]),
    ).rejects.toThrow(/already merged/);

    // Nothing changed: A still redirects to B, B/C still canonical.
    expect((await readPoi(admin, aId)).merged_into).toBe(bId);
    expect((await readPoi(admin, bId)).merged_into).toBeNull();
    expect((await readPoi(admin, cId)).merged_into).toBeNull();

    // WORKAROUND (documented on poi_merge): unmerge the child first, then C ← B
    // succeeds because B no longer has an incoming redirect.
    await admin.query(`SELECT poi_unmerge($1)`, [aId]);
    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [cId, bId]);
    expect((await readPoi(admin, bId)).merged_into).toBe(cId);
    expect((await readPoi(admin, aId)).merged_into).toBeNull();
  });

  it('AC3.6b: LIFO unmerge guard — a later merge into the same kept POI must be unmerged first; then originals restore exactly', async () => {
    const keptRefs = [{ source_kind: 'osm', external_id: 'way/10' }];
    const keptExternal = { osm_id: 'way/10' };
    const kId = await seedPoi(admin, {
      cityId,
      name: 'Kept',
      externalIds: keptExternal,
      sourceRefs: keptRefs,
    });
    const aId = await seedPoi(admin, {
      cityId,
      name: 'A',
      externalIds: { wikidata_id: 'Q-A' },
      sourceRefs: [{ source_kind: 'wikidata', external_id: 'Q-A' }],
    });
    const bId = await seedPoi(admin, {
      cityId,
      name: 'B',
      externalIds: { google_place_id: 'g-B' },
      sourceRefs: [{ source_kind: 'google', external_id: 'g-B' }],
    });

    // Two merges into the SAME kept POI, A first then B (B is the newer merge).
    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [kId, aId]);
    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [kId, bId]);

    // Unmerging A (the older merge) first is refused: a later active merge (B) into
    // the same kept POI exists, and A's snapshot would clobber B's unioned refs.
    await expect(admin.query(`SELECT poi_unmerge($1)`, [aId])).rejects.toThrow(
      /LIFO|must be unmerged first/,
    );

    // LIFO order works: newest (B) first, then A. Both succeed.
    await admin.query(`SELECT poi_unmerge($1)`, [bId]);
    await admin.query(`SELECT poi_unmerge($1)`, [aId]);

    // Redirects cleared and kept's mergeable state restored to its pre-merge originals.
    const kept = await readPoi(admin, kId);
    expect((await readPoi(admin, aId)).merged_into).toBeNull();
    expect((await readPoi(admin, bId)).merged_into).toBeNull();
    expect(kept.source_refs).toEqual(keptRefs);
    expect(kept.external_ids).toEqual(keptExternal);
  });

  it('AC3.5: coord group — kept osm + merged wikidata 40 m apart become verified across the redirect', async () => {
    const keptId = await seedPoi(admin, { cityId, name: 'Kept' });
    const mergedId = await seedPoi(admin, { cityId, name: 'Merged' });
    await insertObs(admin, {
      poiId: keptId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });
    await insertObs(admin, {
      poiId: mergedId,
      sourceKind: 'wikidata',
      lat: PORTO_LAT + offsetLat(40),
      lng: PORTO_LNG,
      accuracyM: 12,
      confidence: 0.85,
    });

    // Individually each is only approximate (one source apiece).
    expect((await readPoi(admin, keptId)).coord_resolution).toBe('approximate');

    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [keptId, mergedId]);

    const kept = await readPoi(admin, keptId);
    expect(kept.coord_resolution).toBe('verified');
    expect(kept.coord_verified_by).toBe('cross_referenced');
  });

  it('AC3.6: unmerge restores the snapshot exactly, clears the redirect, journals undone_at, and recomputes both coords', async () => {
    const keptRefs = [{ source_kind: 'osm', external_id: 'way/1' }];
    const keptExternal = { osm_id: 'way/1', wikidata_id: 'Q1' };
    const keptId = await seedPoi(admin, {
      cityId,
      name: 'Kept',
      externalIds: keptExternal,
      sourceRefs: keptRefs,
    });
    const mergedId = await seedPoi(admin, {
      cityId,
      name: 'Merged',
      externalIds: { wikidata_id: 'Q2', google_place_id: 'g2' },
      sourceRefs: [{ source_kind: 'wikidata', external_id: 'Q2' }],
    });
    await insertObs(admin, {
      poiId: keptId,
      sourceKind: 'osm',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
      accuracyM: 5,
      confidence: 0.9,
    });
    await insertObs(admin, {
      poiId: mergedId,
      sourceKind: 'wikidata',
      lat: PORTO_LAT + offsetLat(40),
      lng: PORTO_LNG,
      accuracyM: 12,
      confidence: 0.85,
    });

    await admin.query(`SELECT poi_merge($1, $2, 'dup', 'test')`, [keptId, mergedId]);
    expect((await readPoi(admin, keptId)).coord_resolution).toBe('verified');

    await admin.query(`SELECT poi_unmerge($1)`, [mergedId]);

    const kept = await readPoi(admin, keptId);
    const merged = await readPoi(admin, mergedId);

    // Redirect cleared.
    expect(merged.merged_into).toBeNull();
    // Snapshot restored byte-for-byte.
    expect(kept.source_refs).toEqual(keptRefs);
    expect(kept.external_ids).toEqual(keptExternal);
    // Journal stamped undone.
    const { rows: journal } = await admin.query<{ undone_at: string | null }>(
      `SELECT undone_at FROM poi_merges WHERE merged_poi_id = $1`,
      [mergedId],
    );
    expect(journal[0]!.undone_at).not.toBeNull();
    // Both recomputed from their OWN observations: kept drops back to approximate.
    expect(kept.coord_resolution).toBe('approximate');
    expect(merged.coord_resolution).toBe('approximate');
  });
});
