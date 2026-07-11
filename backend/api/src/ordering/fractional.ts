import type { PoolClient } from 'pg';

/**
 * Base62 midpoint fractional indexing (§6.3, D47). String `position` keys let a
 * reorder rewrite ONLY the moved row: to drop an item between two neighbours we
 * mint a key strictly between their keys, so siblings are never renumbered — no
 * CRDTs.
 *
 * A key is a base-62 fraction: the digits after an implicit leading `0.`, most
 * significant first, over the alphabet below (ascending codepoint == ascending
 * digit value). So `"1"` = 1/62, `"11"` = 1/62 + 1/62² < `"12"`, etc.
 *
 * INVARIANT — no trailing minimum digit. A key never ends in `'0'` (the alphabet
 * minimum). A trailing `'0'` is value-neutral (`0.X0` == `0.X`), so forbidding it
 * makes each value's string representation canonical: for two keys without a
 * trailing `'0'`, lexicographic order equals numeric order. That equivalence only
 * holds under CODEPOINT ordering, so every `ORDER BY position` in the query layer
 * pins `COLLATE "C"` — the DB default (`en_US.utf8`) would sort case-insensitively
 * and shatter the ordering. `midpoint` preserves the invariant on every output.
 *
 * Server-minted keys are additionally JITTERED (a short random suffix) so two
 * concurrent inserts aiming at the same slot get distinct keys; the
 * `UNIQUE (trip_city_id, position)` index (0013) is the backstop that turns any
 * residual clash into a 23505 the handler retries.
 */

/** Base62 digits in ascending codepoint order: 0-9, A-Z, a-z. */
export const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length; // 62
const ZERO = DIGITS[0]!; // the minimum digit, '0'

/** A key is legal when it is non-empty, all-base62, and does not end in '0'. */
export function isValidKey(key: string): boolean {
  if (key.length === 0) return false;
  if (key.endsWith(ZERO)) return false;
  for (const ch of key) {
    if (DIGITS.indexOf(ch) < 0) return false;
  }
  return true;
}

/**
 * The value strictly between fraction strings `a` and `b`, canonical (never ends
 * in `'0'`). `a` is the lower digit string (`''` means 0 / list start); `b` is the
 * upper digit string, or `null` for the list end (1.0). Ported from the classic
 * fractional-indexing midpoint, generalised to base 62.
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`midpoint: ${a} >= ${b}`);
  if (a.endsWith(ZERO) || (b !== null && b.endsWith(ZERO))) {
    throw new Error('midpoint: inputs must not end in the minimum digit');
  }
  if (b !== null) {
    // Strip the longest common prefix, padding `a` with the zero digit past its
    // end, then recurse on the tails. `b` never ends past a real digit here
    // because `a < b`, so the loop always halts.
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n += 1;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  // The leading digits (or absence of one on `a`) now differ.
  const digitA = a === '' ? 0 : DIGITS.indexOf(a[0]!);
  const digitB = b === null ? BASE : DIGITS.indexOf(b[0]!);
  if (digitB - digitA > 1) {
    // Room for a digit strictly between: take the (rounded) middle one.
    const mid = Math.round(0.5 * (digitA + digitB));
    return DIGITS[mid]!;
  }
  // The bounding digits are consecutive — descend one level.
  if (b !== null && b.length > 1) {
    // e.g. between "1" and "12": borrow "1", the rest is > "1".
    return b.slice(0, 1);
  }
  // `b` is null or a single digit: keep a's leading digit and recurse upward.
  // e.g. midpoint("49","5") -> "4" + midpoint("9", null) -> "4"+"9"+"V" = "49V".
  return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

/**
 * A key strictly between `a` and `b` in codepoint order. `null` bounds mean the
 * list start (`a`) or end (`b`); `keyBetween(null, null)` is the first key of an
 * empty list. Throws if `a >= b` or either bound is not a legal key.
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && !isValidKey(a)) throw new Error(`keyBetween: invalid lower bound ${a}`);
  if (b !== null && !isValidKey(b)) throw new Error(`keyBetween: invalid upper bound ${b}`);
  if (a !== null && b !== null && a >= b) throw new Error(`keyBetween: ${a} >= ${b}`);
  return midpoint(a ?? '', b);
}

/** A key that sorts after `a` (append). */
export function keyAfter(a: string | null): string {
  return keyBetween(a, null);
}

/** A key that sorts before `b` (prepend). */
export function keyBefore(b: string | null): string {
  return keyBetween(null, b);
}

/** A random base62 digit that is never the minimum digit `'0'`. */
function randomNonZeroDigit(): string {
  // Index in [1, BASE-1] so the result is never '0' — keeps the no-trailing-zero
  // invariant intact when appended.
  return DIGITS[1 + Math.floor(Math.random() * (BASE - 1))]!;
}

/**
 * Append 1–2 random non-`'0'` digits to a key. The suffix sorts the jittered key
 * immediately after `key`'s prefix while randomising it, so two concurrent inserts
 * at the same slot land on distinct keys instead of colliding on the unique index.
 * The result is still legal (non-empty, never ends in `'0'`).
 */
export function jitter(key: string): string {
  const count = 1 + Math.floor(Math.random() * 2); // 1 or 2
  let out = key;
  for (let i = 0; i < count; i += 1) out += randomNonZeroDigit();
  return out;
}

/** A key needs rebalancing once it grows past this length (dense-slot backstop). */
export const REBALANCE_THRESHOLD = 40;

/** True when `key` has grown long enough to warrant rebalancing its list. */
export function needsRebalance(key: string): boolean {
  return key.length > REBALANCE_THRESHOLD;
}

function stripTrailingZeros(s: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === ZERO) end -= 1;
  return s.slice(0, end);
}

/**
 * `count` short, evenly spaced, strictly increasing keys (none ending in `'0'`).
 * Used to reset a list whose keys have grown long. Each key encodes the fraction
 * `i / (count + 1)` to enough base62 digits that adjacent keys stay distinct, then
 * drops its value-neutral trailing zeros.
 */
export function rebalanceKeys(count: number): string[] {
  if (count <= 0) return [];
  const base = BigInt(BASE);
  const need = BigInt(count + 1);
  // Smallest m with base^m >= count+1, plus one extra digit so consecutive
  // encodings differ by >= base (they never collide, even after stripping).
  let m = 1;
  let cap = base;
  while (cap < need) {
    cap *= base;
    m += 1;
  }
  m += 1;
  cap *= base;

  const keys: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    let v = (BigInt(i) * cap) / need; // floor
    const buf: string[] = [];
    for (let k = 0; k < m; k += 1) {
      buf.push(DIGITS[Number(v % base)]!);
      v /= base;
    }
    keys.push(stripTrailingZeros(buf.reverse().join('')));
  }
  return keys;
}

/**
 * Rewrite every `trip_places` row in one city stay to fresh short, evenly spaced
 * keys in their current order, reclaiming key space when insertions have made keys
 * long. Runs on the caller's RLS-bound client inside the caller's transaction; the
 * editor USING/WITH CHECK policies (0013) still gate the writes.
 *
 * Done in two statements: a plain non-deferrable UNIQUE index checks per row as an
 * UPDATE proceeds, so assigning the final keys directly can trip a TRANSIENT
 * duplicate against a not-yet-rewritten row. The first UPDATE parks every row on a
 * per-id temporary value outside the base62 alphabet (so it collides with
 * nothing); the second is the single `UPDATE ... FROM unnest(...)` that lays down
 * the real keys, now guaranteed clash-free.
 */
export async function rebalanceTripCity(client: PoolClient, tripCityId: string): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM trip_places WHERE trip_city_id = $1 ORDER BY position COLLATE "C", id`,
    [tripCityId],
  );
  if (rows.length === 0) return;

  const ids = rows.map((r) => r.id);
  const keys = rebalanceKeys(ids.length);

  // Park on '~' || id: '~' (0x7E) is outside the base62 alphabet, so no parked
  // value can equal any current or final key, and each is unique per row. Park
  // ONLY the snapshot ids (not `WHERE trip_city_id = $1`): a row inserted+committed
  // by a concurrent request between the SELECT and here is absent from `ids`, so
  // the final UPDATE never keys it. Parking it too would strand it on a '~' value
  // no rewrite reaches — a persisted, out-of-alphabet position. Leaving it be, at
  // worst its key clashes with a final key and the final UPDATE trips the unique
  // backstop (23505): this whole transaction then rolls back atomically and the
  // 23505 surfaces to the caller as an error. No call site retries a rebalance (the
  // add/patch handlers rebalance OUTSIDE their savepoint guard), so the effect is a
  // failed request, never corruption — nothing is left half-rewritten.
  await client.query(
    `UPDATE trip_places SET position = '~' || id::text WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  await client.query(
    `UPDATE trip_places AS tp
        SET position = v.position
       FROM unnest($1::uuid[], $2::text[]) AS v(id, position)
      WHERE tp.id = v.id`,
    [ids, keys],
  );
}
