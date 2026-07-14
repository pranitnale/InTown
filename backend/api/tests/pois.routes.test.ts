import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PoiCard } from '@intown/contracts/api';
import type { Poi } from '@intown/contracts/types';
import {
  createAdminPool,
  makeTestServer,
  resetTables,
  seedFact,
  seedGeoObservation,
  seedPoi,
  seedReview,
  seedTwoUsers,
  seedUser,
  sessionFor,
  type SeededUser,
  type SeededUsers,
  type TestServer,
} from './helpers/db.ts';

/**
 * P08 AC6 — the three Brain-backed POI reads honor the §5.5 coordinate display
 * gate and the §5.4 merge redirect:
 *  - list/search return only canonical rows and surface coord + coord_resolution
 *    verbatim (grounded → 'verified'/coord; ungrounded → 'unverified'/null);
 *  - the card resolves a merged id to its canonical head and assembles cited
 *    (non-rejected) facts, hours, per-language enrichment, and a review aggregate.
 * Auth is required on all three.
 */
describe('POI reads (AC6)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let users: SeededUsers;
  let cookie: string;

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    users = await seedTwoUsers(admin);
    cookie = await sessionFor(admin, users.a.id);
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  async function seedCity(name = 'Paris'): Promise<string> {
    const { rows } = await admin.query<{ id: string }>(
      `INSERT INTO cities (name, bbox) VALUES ($1, '{}') RETURNING id`,
      [name],
    );
    return rows[0]!.id;
  }

  /** Ground a POI to 'verified' by inserting 2 distinct-source observations within 100 m. */
  async function ground(poiId: string, lat: number, lng: number): Promise<void> {
    await seedGeoObservation(admin, { poi_id: poiId, source_kind: 'osm', lat, lng, confidence: 0.9 });
    await seedGeoObservation(admin, {
      poi_id: poiId,
      source_kind: 'wikidata',
      lat: lat + 0.0001,
      lng: lng + 0.0001,
      confidence: 0.9,
    });
  }

  // -------------------------------------------------------------------------
  // 1. Auth gate
  // -------------------------------------------------------------------------
  it('all three routes 401 without a session', async () => {
    const cityId = await seedCity();
    const poiId = await seedPoi(admin, { city_id: cityId, name: 'Louvre' });
    for (const url of [`/api/pois`, `/api/pois/search?q=Louvre`, `/api/pois/${poiId}/card`]) {
      const res = await ts.app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
  });

  // -------------------------------------------------------------------------
  // 2. list + display gate
  // -------------------------------------------------------------------------
  it('list returns city POIs and surfaces the display gate (verified coord vs ungrounded null)', async () => {
    const cityId = await seedCity();
    const groundedId = await seedPoi(admin, { city_id: cityId, name: 'Grounded', prominence: 0.9 });
    const ungroundedId = await seedPoi(admin, { city_id: cityId, name: 'Ungrounded', prominence: 0.1 });
    await ground(groundedId, 48.8606, 2.3376);

    const res = await ts.app.inject({
      method: 'GET',
      url: `/api/pois?city_id=${cityId}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Poi[];
    expect(body).toHaveLength(2);

    const grounded = body.find((p) => p.id === groundedId)!;
    expect(grounded.coord_resolution).toBe('verified');
    expect(grounded.coord).not.toBeNull();
    expect(grounded.coord!.lat).toBeCloseTo(48.8606, 3);
    expect(grounded.coord!.lng).toBeCloseTo(2.3376, 3);

    const ungrounded = body.find((p) => p.id === ungroundedId)!;
    expect(ungrounded.coord_resolution).toBe('unverified');
    expect(ungrounded.coord).toBeNull();

    // Deterministic order: higher prominence first.
    expect(body[0]!.id).toBe(groundedId);
  });

  // -------------------------------------------------------------------------
  // 2b. display gate — the THIRD state: single-source → 'approximate' + coord kept
  // -------------------------------------------------------------------------
  it('list/card keep a single-observation POI as approximate with a non-null coord (D52: kept but non-navigable)', async () => {
    const cityId = await seedCity();
    const poiId = await seedPoi(admin, { city_id: cityId, name: 'Single Source' });
    // ONE observation → grounded but not cross-referenced (only 1 distinct source
    // within 100 m): resolution 'approximate', coord retained (not nulled).
    await seedGeoObservation(admin, {
      poi_id: poiId,
      source_kind: 'osm',
      lat: 48.86,
      lng: 2.34,
      confidence: 0.9,
    });

    const list = await ts.app.inject({
      method: 'GET',
      url: `/api/pois?city_id=${cityId}`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    const listPoi = (list.json() as Poi[]).find((p) => p.id === poiId)!;
    expect(listPoi.coord_resolution).toBe('approximate');
    expect(listPoi.coord).not.toBeNull();

    const card = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/${poiId}/card`,
      headers: { cookie },
    });
    expect(card.statusCode).toBe(200);
    const cardPoi = (card.json() as PoiCard).poi;
    expect(cardPoi.coord_resolution).toBe('approximate');
    expect(cardPoi.coord).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 3. bbox + category + min_prominence filters
  // -------------------------------------------------------------------------
  it('bbox excludes out-of-box POIs and composes with category + min_prominence', async () => {
    const cityId = await seedCity();
    // In-box: a Paris museum with high prominence.
    const inBox = await seedPoi(admin, {
      city_id: cityId,
      name: 'In Box Museum',
      category: 'MUSEUM',
      prominence: 0.8,
    });
    await ground(inBox, 48.8606, 2.3376);
    // In-box but a CAFE (category filter should drop it).
    const inBoxCafe = await seedPoi(admin, {
      city_id: cityId,
      name: 'In Box Cafe',
      category: 'CAFE',
      prominence: 0.8,
    });
    await ground(inBoxCafe, 48.861, 2.338);
    // Out-of-box: grounded far away (Berlin-ish).
    const outBox = await seedPoi(admin, {
      city_id: cityId,
      name: 'Out Museum',
      category: 'MUSEUM',
      prominence: 0.8,
    });
    await ground(outBox, 52.52, 13.405);
    // In-box museum with low prominence (min_prominence should drop it).
    const lowProm = await seedPoi(admin, {
      city_id: cityId,
      name: 'Low Prominence',
      category: 'MUSEUM',
      prominence: 0.2,
    });
    await ground(lowProm, 48.8605, 2.3377);

    // bbox "minLng,minLat,maxLng,maxLat" around central Paris.
    const bbox = '2.30,48.84,2.40,48.88';
    const res = await ts.app.inject({
      method: 'GET',
      url: `/api/pois?city_id=${cityId}&bbox=${bbox}&category=MUSEUM&min_prominence=0.5`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const ids = (res.json() as Poi[]).map((p) => p.id);
    expect(ids).toContain(inBox);
    expect(ids).not.toContain(inBoxCafe); // wrong category
    expect(ids).not.toContain(outBox); // out of bbox
    expect(ids).not.toContain(lowProm); // below min_prominence
    expect(ids).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 4. search
  // -------------------------------------------------------------------------
  it('search matches exact / partial name and aliases, is city-biased, and 400s on empty q', async () => {
    const paris = await seedCity('Paris');
    const berlin = await seedCity('Berlin');
    const louvre = await seedPoi(admin, {
      city_id: paris,
      name: 'Musée du Louvre',
      aliases: ['The Louvre'],
    });
    await seedPoi(admin, { city_id: berlin, name: 'Musée du Louvre (replica)' });

    // Partial name hit.
    const partial = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/search?q=Louvre`,
      headers: { cookie },
    });
    expect(partial.statusCode).toBe(200);
    expect((partial.json() as Poi[]).length).toBeGreaterThanOrEqual(2);

    // Alias hit ("The Louvre" is only an alias of the Paris row).
    const alias = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/search?q=${encodeURIComponent('The Louvre')}&city_id=${paris}`,
      headers: { cookie },
    });
    expect(alias.statusCode).toBe(200);
    const aliasIds = (alias.json() as Poi[]).map((p) => p.id);
    expect(aliasIds).toContain(louvre);

    // City bias: only the Paris row.
    const biased = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/search?q=${encodeURIComponent('Musée du Louvre')}&city_id=${paris}`,
      headers: { cookie },
    });
    expect(biased.statusCode).toBe(200);
    const biasedIds = (biased.json() as Poi[]).map((p) => p.id);
    expect(biasedIds).toEqual([louvre]);

    // Empty q → zod 400.
    const empty = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/search?q=`,
      headers: { cookie },
    });
    expect(empty.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // 5. card assembly
  // -------------------------------------------------------------------------
  it('card assembles non-rejected facts, hours, language-scoped enrichment, and review aggregate', async () => {
    const cityId = await seedCity();
    const poiId = await seedPoi(admin, { city_id: cityId, name: 'Card POI' });

    // Facts: official hours must beat a newer conflicting web report; rejected
    // and superseded history must not appear as extra card rows.
    await seedFact(admin, {
      entity_id: poiId,
      attribute: 'hours',
      value: { open: '09:00' },
      source_url: 'https://museum.example/hours',
      observed_at: '2026-01-01T00:00:00Z',
    });
    await seedFact(admin, {
      entity_id: poiId,
      attribute: 'hours',
      value: { open: '11:00' },
      source_kind: 'web_review',
      observed_at: '2026-06-01T00:00:00Z',
    });
    await seedFact(admin, { entity_id: poiId, attribute: 'price', value: { amount: 15 } });
    await seedFact(admin, {
      entity_id: poiId,
      attribute: 'best_time',
      value: { window: 'sunrise' },
      source_kind: 'web_review',
      corroboration_count: 0,
    });
    await seedFact(admin, {
      entity_id: poiId,
      attribute: 'price',
      value: { amount: 99 },
      status: 'superseded',
    });
    await seedFact(admin, {
      entity_id: poiId,
      attribute: 'hours',
      value: { open: 'WRONG' },
      status: 'rejected',
    });

    // Hours row.
    await admin.query(
      `INSERT INTO poi_hours (poi_id, day_of_week, opens, closes) VALUES ($1, 0, '09:00', '18:00')`,
      [poiId],
    );

    // Enrichment: 'en' present, 'fr' absent.
    await admin.query(
      `INSERT INTO poi_enrichment (poi_id, language, significance) VALUES ($1, 'en', 'A grand museum.')`,
      [poiId],
    );

    // Reviews: two published (avg (4+2)/2 = 3), one pending (excluded).
    const carol = await seedUser(admin, 'carol@example.com');
    await seedReview(admin, { poi_id: poiId, user_id: users.a.id, rating: 4, status: 'published' });
    await seedReview(admin, { poi_id: poiId, user_id: users.b.id, rating: 2, status: 'published' });
    await seedReview(admin, { poi_id: poiId, user_id: carol.id, rating: 5, status: 'pending' });

    const res = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/${poiId}/card?language=en`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const card = res.json() as PoiCard;

    expect(card.poi.id).toBe(poiId);
    expect(card.facts).toHaveLength(3);
    expect(card.facts.every((f) => f.status === 'active')).toBe(true);
    const hoursFact = card.facts.find((fact) => fact.attribute === 'hours')!;
    expect(hoursFact.value).toEqual({ open: '09:00' });
    expect(hoursFact.selected_by).toBe('official_operational');
    expect(hoursFact.disputed).toBe(true);
    expect(hoursFact.citation).toBe('https://museum.example/hours');
    expect(hoursFact.as_of).toBe(hoursFact.observed_at);
    const priceFact = card.facts.find((fact) => fact.attribute === 'price')!;
    expect(priceFact.citation).toBe('N/A');
    const bestTime = card.facts.find((fact) => fact.attribute === 'best_time')!;
    expect(bestTime.single_report).toBe(true);
    expect(bestTime.citation).toBe('N/A');
    expect(card.hours).toHaveLength(1);
    expect(card.hours[0]!.opens).toBe('09:00');
    expect(card.enrichment).not.toBeNull();
    expect(card.enrichment!.language).toBe('en');
    expect(card.reviews).toHaveLength(2);
    expect(card.rating_count).toBe(2);
    expect(card.rating_avg).toBe(3);

    // A different language → enrichment null (the 'en' row must not leak).
    const frRes = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/${poiId}/card?language=fr`,
      headers: { cookie },
    });
    expect(frRes.statusCode).toBe(200);
    expect((frRes.json() as PoiCard).enrichment).toBeNull();
  });

  it('card returns rating_avg null and rating_count 0 for a POI with no published reviews', async () => {
    const cityId = await seedCity();
    const poiId = await seedPoi(admin, { city_id: cityId, name: 'No Reviews' });
    const res = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/${poiId}/card`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const card = res.json() as PoiCard;
    expect(card.rating_count).toBe(0);
    expect(card.rating_avg).toBeNull();
    expect(card.reviews).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 6. merge redirect
  // -------------------------------------------------------------------------
  it('a merged POI is hidden from list/search; its card redirects to the canonical head', async () => {
    const cityId = await seedCity();
    const kept = await seedPoi(admin, { city_id: cityId, name: 'Canonical Tower' });
    const merged = await seedPoi(admin, { city_id: cityId, name: 'Canonical Tower' });
    await admin.query(`SELECT poi_merge($1, $2, $3, $4)`, [kept, merged, 'duplicate', 'test']);

    // List: only the canonical row.
    const list = await ts.app.inject({
      method: 'GET',
      url: `/api/pois?city_id=${cityId}`,
      headers: { cookie },
    });
    const listIds = (list.json() as Poi[]).map((p) => p.id);
    expect(listIds).toContain(kept);
    expect(listIds).not.toContain(merged);

    // Search: merged id never appears.
    const search = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/search?q=${encodeURIComponent('Canonical Tower')}`,
      headers: { cookie },
    });
    const searchIds = (search.json() as Poi[]).map((p) => p.id);
    expect(searchIds).toContain(kept);
    expect(searchIds).not.toContain(merged);

    // Card on the MERGED id resolves to the canonical (kept) POI.
    const card = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/${merged}/card`,
      headers: { cookie },
    });
    expect(card.statusCode).toBe(200);
    expect((card.json() as PoiCard).poi.id).toBe(kept);
  });

  // -------------------------------------------------------------------------
  // 6b. merge-group folding — poi_merge never moves facts/hours/reviews off the
  // merged-away duplicate, so the card must fold the whole one-hop group.
  // -------------------------------------------------------------------------
  it('card folds the merge group: facts/hours/reviews/aggregate span both POIs; enrichment prefers canonical', async () => {
    const cityId = await seedCity();
    const kept = await seedPoi(admin, { city_id: cityId, name: 'Group Head' });
    const merged = await seedPoi(admin, { city_id: cityId, name: 'Group Head' });

    // Distinct facts on each side of the group.
    await seedFact(admin, { entity_id: kept, attribute: 'price', value: { amount: 10 } });
    await seedFact(admin, { entity_id: merged, attribute: 'phone', value: { number: '123' } });

    // A poi_hours row on each side (distinct day_of_week).
    await admin.query(
      `INSERT INTO poi_hours (poi_id, day_of_week, opens, closes) VALUES ($1, 1, '09:00', '17:00')`,
      [kept],
    );
    await admin.query(
      `INSERT INTO poi_hours (poi_id, day_of_week, opens, closes) VALUES ($1, 2, '10:00', '18:00')`,
      [merged],
    );

    // Enrichment for 'en' on BOTH — the canonical row must win deterministically.
    await admin.query(
      `INSERT INTO poi_enrichment (poi_id, language, significance) VALUES ($1, 'en', 'Canonical significance.')`,
      [kept],
    );
    await admin.query(
      `INSERT INTO poi_enrichment (poi_id, language, significance) VALUES ($1, 'en', 'Duplicate significance.')`,
      [merged],
    );

    // Published reviews on each side (aggregate avg (4+2)/2 = 3, count 2).
    await seedReview(admin, { poi_id: kept, user_id: users.a.id, rating: 4, status: 'published' });
    await seedReview(admin, { poi_id: merged, user_id: users.b.id, rating: 2, status: 'published' });

    // Fold merged into kept (admin pool = superuser owner).
    await admin.query(`SELECT poi_merge($1, $2, $3, $4)`, [kept, merged, 'duplicate', 'test']);

    // Probing EITHER id resolves to the same canonical card with the folded group.
    for (const probe of [kept, merged]) {
      const res = await ts.app.inject({
        method: 'GET',
        url: `/api/pois/${probe}/card?language=en`,
        headers: { cookie },
      });
      expect(res.statusCode, `card(${probe})`).toBe(200);
      const card = res.json() as PoiCard;

      expect(card.poi.id, `card(${probe}) canonical head`).toBe(kept);

      // Facts from BOTH sides are reachable.
      expect(card.facts.map((f) => f.attribute).sort()).toEqual(['phone', 'price']);

      // Hours from BOTH sides.
      expect(card.hours).toHaveLength(2);
      expect(card.hours.map((h) => h.day_of_week).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
        1, 2,
      ]);

      // Review list + aggregate span the whole group.
      expect(card.reviews).toHaveLength(2);
      expect(card.rating_count).toBe(2);
      expect(card.rating_avg).toBe(3);

      // Enrichment resolves canonical-first (not the duplicate's row).
      expect(card.enrichment).not.toBeNull();
      expect(card.enrichment!.poi_id).toBe(kept);
      expect(card.enrichment!.significance).toBe('Canonical significance.');
    }
  });

  // -------------------------------------------------------------------------
  // 7. unknown id
  // -------------------------------------------------------------------------
  it('card on an unknown uuid 404s', async () => {
    const res = await ts.app.inject({
      method: 'GET',
      url: `/api/pois/99999999-9999-4999-8999-999999999999/card`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
