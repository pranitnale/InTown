import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import poisFixtureRaw from '@intown/contracts/fixtures/brain-slice/pois.json';
import factsFixtureRaw from '@intown/contracts/fixtures/brain-slice/facts.json';
import { createAdminPool, resetBrain, seedCity, seedPoi } from './helpers/brain.ts';

/**
 * P08 AC1 — the atomic-fact tuple (§5.3) is stored exactly as specified and the
 * facts log is append-only (0010). DB-level: the superuser pool inserts + reads
 * facts directly and confirms the UPDATE/DELETE guards fire. No HTTP.
 */

interface PoiFixtureRow {
  id: string;
  city_id: string;
  name: string;
  category: string;
  indoor_outdoor: string;
}
interface FactFixtureRow {
  id: string;
  entity_kind: string;
  entity_id: string;
  attribute: string;
  value: unknown;
  source_url: string | null;
  source_kind: string;
  observed_at: string;
  confidence: number;
  corroboration_count: number;
  status: string;
}
const poisFixture = poisFixtureRaw as unknown as PoiFixtureRow[];
const factsFixture = factsFixtureRaw as unknown as FactFixtureRow[];

/** The fixture city id every brain-slice row hangs off (no cities.json fixture). */
const FIXTURE_CITY_ID = 'c0a70000-0000-4000-8000-000000000001';

describe('Brain facts — §5.3 tuple + append-only (AC1)', () => {
  const admin = createAdminPool();

  beforeEach(async () => {
    await resetBrain(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it('round-trips the full §5.3 tuple exactly', async () => {
    const cityId = await seedCity(admin);
    const poiId = await seedPoi(admin, { cityId, name: 'Livraria Lello', category: 'SHOPPING' });

    const value = { amount: 8, currency: 'EUR', note: 'redeemable against a book purchase' };
    const observedAt = '2026-05-20T10:00:00.000Z';
    const { rows: ins } = await admin.query<{ id: string }>(
      `INSERT INTO facts
         (entity_kind, entity_id, attribute, value, source_url, source_kind,
          observed_at, confidence, corroboration_count, status)
       VALUES ('poi', $1, 'admission_price', $2::jsonb, $3, 'official_site', $4, $5, $6, 'active')
       RETURNING id`,
      [poiId, JSON.stringify(value), 'https://www.livrarialello.pt/en/visit', observedAt, 0.95, 3],
    );
    const factId = ins[0]!.id;

    const { rows } = await admin.query<{
      entity_kind: string;
      entity_id: string;
      attribute: string;
      value: unknown;
      source_url: string;
      source_kind: string;
      observed_at: Date;
      confidence: number;
      corroboration_count: number;
      status: string;
    }>(`SELECT * FROM facts WHERE id = $1`, [factId]);
    const row = rows[0]!;

    expect(row.entity_kind).toBe('poi');
    expect(row.entity_id).toBe(poiId);
    expect(row.attribute).toBe('admission_price');
    expect(row.value).toEqual(value);
    expect(row.source_url).toBe('https://www.livrarialello.pt/en/visit');
    expect(row.source_kind).toBe('official_site');
    expect(row.observed_at.toISOString()).toBe(observedAt);
    expect(row.confidence).toBe(0.95);
    expect(row.corroboration_count).toBe(3);
    expect(row.status).toBe('active');
  });

  it('has exactly the §5.3 column set with the right types (against the 0005 definition)', async () => {
    const { rows } = await admin.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'facts'
        ORDER BY column_name`,
    );
    const byName = new Map(rows.map((r) => [r.column_name, r.data_type]));

    // 0005 facts has NO created_at — the tuple is exactly these 11 columns.
    expect([...byName.keys()].sort()).toEqual(
      [
        'attribute',
        'confidence',
        'corroboration_count',
        'entity_id',
        'entity_kind',
        'id',
        'observed_at',
        'source_kind',
        'source_url',
        'status',
        'value',
      ].sort(),
    );

    // The §5.3 tuple fields exist with the right column types.
    expect(byName.get('id')).toBe('uuid');
    expect(byName.get('entity_kind')).toBe('USER-DEFINED'); // fact_entity_kind enum
    expect(byName.get('entity_id')).toBe('uuid');
    expect(byName.get('attribute')).toBe('text');
    expect(byName.get('value')).toBe('jsonb');
    expect(byName.get('source_url')).toBe('text');
    expect(byName.get('source_kind')).toBe('USER-DEFINED'); // fact_source_kind enum
    expect(byName.get('observed_at')).toBe('timestamp with time zone');
    expect(byName.get('confidence')).toBe('double precision');
    expect(byName.get('corroboration_count')).toBe('integer');
    expect(byName.get('status')).toBe('USER-DEFINED'); // fact_status enum
  });

  it('rejects direct UPDATE and DELETE — the log is append-only', async () => {
    const cityId = await seedCity(admin);
    const poiId = await seedPoi(admin, { cityId });
    const { rows: ins } = await admin.query<{ id: string }>(
      `INSERT INTO facts (entity_kind, entity_id, attribute, value, source_kind, observed_at, confidence)
       VALUES ('poi', $1, 'vibe', '"lively"'::jsonb, 'web_review', now(), 0.6)
       RETURNING id`,
      [poiId],
    );
    const factId = ins[0]!.id;

    await expect(
      admin.query(`UPDATE facts SET confidence = 0.1 WHERE id = $1`, [factId]),
    ).rejects.toThrow(/append-only/);
    await expect(admin.query(`DELETE FROM facts WHERE id = $1`, [factId])).rejects.toThrow(
      /append-only/,
    );

    // The row is untouched by both rejected mutations.
    const { rows } = await admin.query<{ confidence: number; cnt: string }>(
      `SELECT confidence, (SELECT count(*)::text FROM facts WHERE id = $1) AS cnt
         FROM facts WHERE id = $1`,
      [factId],
    );
    expect(rows[0]!.confidence).toBe(0.6);
    expect(rows[0]!.cnt).toBe('1');
  });

  it('replays every brain-slice fact fixture row and reads it back with equal values', async () => {
    // Seed the referenced city + pois first (facts.entity_id is polymorphic, no FK).
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

    for (const f of factsFixture) {
      await admin.query(
        `INSERT INTO facts
           (id, entity_kind, entity_id, attribute, value, source_url, source_kind,
            observed_at, confidence, corroboration_count, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)`,
        [
          f.id,
          f.entity_kind,
          f.entity_id,
          f.attribute,
          f.value === null ? null : JSON.stringify(f.value),
          f.source_url,
          f.source_kind,
          f.observed_at,
          f.confidence,
          f.corroboration_count,
          f.status,
        ],
      );
    }

    const { rows: countRows } = await admin.query<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM facts`,
    );
    expect(Number(countRows[0]!.cnt)).toBe(factsFixture.length);

    for (const f of factsFixture) {
      const { rows } = await admin.query<{
        entity_kind: string;
        entity_id: string;
        attribute: string;
        value: unknown;
        source_url: string | null;
        source_kind: string;
        observed_at: Date;
        confidence: number;
        corroboration_count: number;
        status: string;
      }>(`SELECT * FROM facts WHERE id = $1`, [f.id]);
      const row = rows[0]!;
      expect(row.entity_kind).toBe(f.entity_kind);
      expect(row.entity_id).toBe(f.entity_id);
      expect(row.attribute).toBe(f.attribute);
      expect(row.value).toEqual(f.value);
      expect(row.source_url).toBe(f.source_url);
      expect(row.source_kind).toBe(f.source_kind);
      expect(row.observed_at.getTime()).toBe(Date.parse(f.observed_at));
      expect(row.confidence).toBe(f.confidence);
      expect(row.corroboration_count).toBe(f.corroboration_count);
      expect(row.status).toBe(f.status);
    }
  });
});
