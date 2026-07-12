import type { Fact, FactSourceKind } from '@intown/contracts/types';

/**
 * Fact conflict resolver (P08, §5.3, D23). PURE + synchronous — no I/O, no DB,
 * no HTTP route (contracts define none; the consumers are the card endpoint and
 * P14). Given every fact ever observed for ONE (entity, attribute), it selects a
 * single winning fact and records WHICH rule selected it.
 *
 * The seam is per fact TYPE, never per source: a fact's provenance
 * (`source_kind`) informs the rules, but the winner is chosen by the ATTRIBUTE's
 * class, so an official source beats a newer blog on hours while that same blog
 * can win on crowd level.
 *
 * FOUR-RULE HIERARCHY (§5.3 / D23):
 *   1. official_operational — for OPERATIONAL facts (hours, price, booking) an
 *      official source (official_site / open_data) wins; the newest official if
 *      several. Officials are authoritative on facts they publish.
 *   2. newest_time_sensitive — for TIME-SENSITIVE facts (crowd level, wait time,
 *      temporary closure), and for operational facts with no official source, the
 *      newest observation wins. Freshness governs volatile signals.
 *   3. recency_tolerant_experiential — for EXPERIENTIAL insights (vibe, tips,
 *      significance) the highest-confidence fact wins even if older; a strong
 *      older insight is not displaced by a weaker newer one.
 *   4. verified_visitor_correction — a user correction corroborated by at least
 *      USER_CORRECTION_MIN_CORROBORATION confirmations outranks the rules-1-3
 *      winner when it is NEWER than that winner OR that winner's citation is stale
 *      (older than STALE_DAYS). Verified ground truth trumps stale citations.
 *
 * Rule 4 is evaluated as an OVERRIDE on top of the rules-1-3 winner so the
 * selecting rule is always the most specific one that decided the outcome.
 *
 * DETERMINISM: every selection is a total order — the class rule first, then the
 * documented tie-breaks, with a final lexicographic `id` tie-break so the winner
 * is stable regardless of input order.
 */

/** N confirmations a user correction needs before it can override (D23 rule 4). Tunable. */
export const USER_CORRECTION_MIN_CORROBORATION = 2;

/** Citation staleness horizon in days (D23 rule 4). Tunable. */
export const STALE_DAYS = 365;

const MS_PER_DAY = 86_400_000;

/** The rule that selected the winning fact (recorded per D23). */
export type SelectionRule =
  | 'official_operational' // rule 1: official source wins operational facts
  | 'newest_time_sensitive' // rule 2: newest among non-official for time-sensitive
  | 'recency_tolerant_experiential' // rule 3: stable experiential insights keep older values
  | 'verified_visitor_correction'; // rule 4: corroborated user correction outranks stale citations

/** How an attribute's winner is chosen (unknown attributes default to 'experiential'). */
export type AttributeClass = 'operational' | 'time_sensitive' | 'experiential';

/**
 * Attribute → class map. Any attribute not listed here defaults to
 * 'experiential' (recency-tolerant, confidence-led), the safest default for the
 * open-ended narrative facts the pipeline emits.
 */
export const ATTRIBUTE_CLASS: Readonly<Record<string, AttributeClass>> = {
  // operational — facts an official operator publishes and is authoritative on
  hours: 'operational',
  opening_hours: 'operational',
  price: 'operational',
  admission_price: 'operational',
  ticket_price: 'operational',
  pass_price: 'operational',
  booking_required: 'operational',
  // time-sensitive — volatile signals where the freshest reading governs
  crowd_level: 'time_sensitive',
  wait_time: 'time_sensitive',
  temporary_closure: 'time_sensitive',
  construction_status: 'time_sensitive',
};

/** Sources treated as official for operational facts (rule 1). */
const OFFICIAL_SOURCE_KINDS: ReadonlySet<FactSourceKind> = new Set<FactSourceKind>([
  'official_site',
  'open_data',
]);

function observedMs(fact: Fact): number {
  return Date.parse(fact.observed_at);
}

function compareId(a: Fact, b: Fact): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Newest-first total order: newer observed_at, then higher confidence, then
 * higher corroboration_count, then lexicographic id. Returns <0 when `a` ranks
 * ahead of `b`.
 */
function cmpNewest(a: Fact, b: Fact): number {
  return (
    observedMs(b) - observedMs(a) ||
    b.confidence - a.confidence ||
    b.corroboration_count - a.corroboration_count ||
    compareId(a, b)
  );
}

/**
 * Highest-confidence total order: higher confidence, then higher
 * corroboration_count, then newer observed_at, then lexicographic id. Returns <0
 * when `a` ranks ahead of `b`.
 */
function cmpConfidence(a: Fact, b: Fact): number {
  return (
    b.confidence - a.confidence ||
    b.corroboration_count - a.corroboration_count ||
    observedMs(b) - observedMs(a) ||
    compareId(a, b)
  );
}

/** The winning fact under rules 1–3 (rule 4 is applied by the caller as an override). */
function selectBase(
  active: readonly Fact[],
  cls: AttributeClass,
): { fact: Fact; rule: SelectionRule } {
  if (cls === 'operational') {
    const official = active.filter((f) => OFFICIAL_SOURCE_KINDS.has(f.source_kind));
    if (official.length > 0) {
      return { fact: [...official].sort(cmpNewest)[0]!, rule: 'official_operational' };
    }
    // No official source: fall through to the freshest overall reading.
    return { fact: [...active].sort(cmpNewest)[0]!, rule: 'newest_time_sensitive' };
  }
  if (cls === 'time_sensitive') {
    return { fact: [...active].sort(cmpNewest)[0]!, rule: 'newest_time_sensitive' };
  }
  // experiential
  return { fact: [...active].sort(cmpConfidence)[0]!, rule: 'recency_tolerant_experiential' };
}

/**
 * Select the winning fact for ONE (entity, attribute) and the rule that chose it,
 * or null when there is nothing selectable. All `facts` MUST share one attribute;
 * a mixed-attribute input throws (a caller must group first — see
 * {@link selectFactsByAttribute}).
 *
 * @param facts every observed fact for the (entity, attribute).
 * @param now injectable clock for staleness (rule 4); defaults to the wall clock.
 */
export function selectFact(
  facts: readonly Fact[],
  now: Date = new Date(),
): { fact: Fact; rule: SelectionRule } | null {
  // 1. Only 'active' facts are selectable. This is a deliberate allow-list, not a
  // reject-list: 'rejected' (invalidated), 'superseded' (retracted by a newer
  // row), and 'disputed' (contested, not safely assertable) are ALL excluded, so
  // none of them can ever be surfaced as the selected value.
  const active = facts.filter((f) => f.status === 'active');
  if (active.length === 0) return null;

  // Guard: one attribute per call.
  const attribute = active[0]!.attribute;
  for (const f of active) {
    if (f.attribute !== attribute) {
      throw new Error(
        `selectFact: mixed attributes ('${attribute}' vs '${f.attribute}') — facts must share one (entity, attribute); group with selectFactsByAttribute first`,
      );
    }
  }

  // 2. Attribute class (unknown → experiential).
  const cls = ATTRIBUTE_CLASS[attribute] ?? 'experiential';

  // 3–6. Rules 1–3 winner.
  const base = selectBase(active, cls);

  // Rule 4 override: a corroborated user correction outranks the base winner ONLY
  // when it is strictly newer than that winner OR the base citation is stale
  // (observed_at older than STALE_DAYS). It never fires merely because the base
  // winner is itself a correction — if the base (via rules 1–3) already IS the
  // newest corroborated correction, it outranked nothing, so the rules-1-3 rule
  // stands (e.g. 'newest_time_sensitive'), not 'verified_visitor_correction'.
  const corroborated = active.filter(
    (f) =>
      f.source_kind === 'user_correction' &&
      f.corroboration_count >= USER_CORRECTION_MIN_CORROBORATION,
  );
  if (corroborated.length > 0) {
    const correction = [...corroborated].sort(cmpNewest)[0]!;
    const correctionNewer = observedMs(correction) > observedMs(base.fact);
    const baseStale = observedMs(base.fact) < now.getTime() - STALE_DAYS * MS_PER_DAY;
    if (correctionNewer || baseStale) {
      return { fact: correction, rule: 'verified_visitor_correction' };
    }
  }

  return base;
}

/**
 * Group a flat fact list by attribute and run {@link selectFact} per group. The
 * card endpoint / P14 use this to resolve every attribute of an entity at once.
 *
 * @param facts a flat list spanning one or more attributes of one entity.
 * @param now injectable clock forwarded to {@link selectFact}.
 */
export function selectFactsByAttribute(
  facts: readonly Fact[],
  now: Date = new Date(),
): Map<string, { fact: Fact; rule: SelectionRule }> {
  const groups = new Map<string, Fact[]>();
  for (const f of facts) {
    const group = groups.get(f.attribute);
    if (group) group.push(f);
    else groups.set(f.attribute, [f]);
  }

  const out = new Map<string, { fact: Fact; rule: SelectionRule }>();
  for (const [attribute, group] of groups) {
    const selected = selectFact(group, now);
    if (selected) out.set(attribute, selected);
  }
  return out;
}
