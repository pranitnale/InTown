/**
 * Generate the `contracts/python` mirror (JSON Schemas + pydantic v2 models)
 * from the frozen zod v4 contract in `contracts/types`, `contracts/events`, and
 * the solver / research API seams.
 *
 * Pipeline:
 *   1. Register every entity schema, event payload, the solver request/response
 *      pair, and the key research API request/response + SSE shapes in a single
 *      zod registry under stable ids.
 *   2. `z.toJSONSchema(registry, …)` emits one JSON Schema per id (draft
 *      2020-12); shared sub-schemas (Money, Coordinate, SourceRef, …) are
 *      registered too, so they are factored out into their own `$defs`-style
 *      file and `$ref`'d rather than duplicated inline.
 *   3. Each schema is written deterministically (recursively sorted keys,
 *      trailing newline) to `contracts/python/jsonschema/<Id>.json`.
 *   4. `datamodel-codegen` (from the repo `.venv`) turns that directory into
 *      pydantic v2 models in `contracts/python/intown_contracts/`.
 *
 * Output is deterministic across runs — CI drift-checks it. NEVER hand-edit the
 * generated files; re-run `pnpm --filter @intown/contracts run generate:python`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';

import {
  // shared value objects (§10 primitives — registered so they become shared defs)
  Money,
  Coordinate,
  SourceRef,
  // users
  User,
  TravelerProfile,
  TasteProfile,
  Consent,
  AccountExport,
  // trips
  Trip,
  TripCity,
  TripMember,
  TripInvite,
  IntercityLeg,
  // curation
  TripPlace,
  PlaceVote,
  PlanRevision,
  Stop,
  // brain
  BBox,
  City,
  PoiExternalIds,
  PoiAccessibility,
  Poi,
  PoiGeoObservation,
  Fact,
  PoiHours,
  PoiEnrichment,
  CityBrief,
  ScenicLeg,
  TransitPass,
  // community
  Review,
  ModerationAction,
  Correction,
  WantToGo,
  Badge,
  UserBadge,
  // learning
  Event,
  UserPrefProfile,
  ItemStats,
  // vault
  TripDocument,
  TicketLink,
} from '../types/index.ts';

import {
  RankedItem,
  ListShownPayload,
  PlaceReorderedPayload,
  PlaceRemovedPayload,
  CardOpenedPayload,
  MustDoLockedPayload,
  VoteCastPayload,
  PlaceVisitedPayload,
  PlaceSkippedPayload,
  NarrationGeneratedPayload,
  NarrationCompletedPayload,
  GoNowTriggeredPayload,
  ClosedReportedPayload,
  PriceCorrectedPayload,
  PlanRegeneratedPayload,
  DayFeedbackPayload,
  ListFinalizedPayload,
} from '../events/index.ts';

import {
  SolverAnchor,
  SolverOpeningWindow,
  SolverCandidate,
  SolverDay,
  SolverTravelEdge,
  SolverRequest,
  SolverTravelLeg,
  SolverScheduledStop,
  SolverDaySchedule,
  SolverResponse,
} from '../api/solver.ts';

import {
  ResearchRequest,
  ResearchResult,
  ResearchStageStarted,
  ResearchStageLog,
  ResearchPlaceFound,
  ResearchCandidateScored,
  ResearchStageCompleted,
  ResearchCompleted,
  ResearchStreamMessage,
} from '../api/research.ts';
import { SseError } from '../api/sse.ts';

/**
 * The registry. Order here is irrelevant to output (files are sorted by id) but
 * grouped for review. Ids are the PascalCase schema names — they become the
 * generated pydantic class names, which the fixture test imports.
 */
const ENTRIES: ReadonlyArray<readonly [string, z.ZodType]> = [
  // shared value objects
  ['Money', Money],
  ['Coordinate', Coordinate],
  ['SourceRef', SourceRef],
  // users
  ['User', User],
  ['TravelerProfile', TravelerProfile],
  ['TasteProfile', TasteProfile],
  ['Consent', Consent],
  ['AccountExport', AccountExport],
  // trips
  ['Trip', Trip],
  ['TripCity', TripCity],
  ['TripMember', TripMember],
  ['TripInvite', TripInvite],
  ['IntercityLeg', IntercityLeg],
  // curation
  ['TripPlace', TripPlace],
  ['PlaceVote', PlaceVote],
  ['PlanRevision', PlanRevision],
  ['Stop', Stop],
  // brain
  ['BBox', BBox],
  ['City', City],
  ['PoiExternalIds', PoiExternalIds],
  ['PoiAccessibility', PoiAccessibility],
  ['Poi', Poi],
  ['PoiGeoObservation', PoiGeoObservation],
  ['Fact', Fact],
  ['PoiHours', PoiHours],
  ['PoiEnrichment', PoiEnrichment],
  ['CityBrief', CityBrief],
  ['ScenicLeg', ScenicLeg],
  ['TransitPass', TransitPass],
  // community
  ['Review', Review],
  ['ModerationAction', ModerationAction],
  ['Correction', Correction],
  ['WantToGo', WantToGo],
  ['Badge', Badge],
  ['UserBadge', UserBadge],
  // learning
  ['Event', Event],
  ['UserPrefProfile', UserPrefProfile],
  ['ItemStats', ItemStats],
  // vault
  ['TripDocument', TripDocument],
  ['TicketLink', TicketLink],
  // event payloads (§9.1)
  ['RankedItem', RankedItem],
  ['ListShownPayload', ListShownPayload],
  ['PlaceReorderedPayload', PlaceReorderedPayload],
  ['PlaceRemovedPayload', PlaceRemovedPayload],
  ['CardOpenedPayload', CardOpenedPayload],
  ['MustDoLockedPayload', MustDoLockedPayload],
  ['VoteCastPayload', VoteCastPayload],
  ['PlaceVisitedPayload', PlaceVisitedPayload],
  ['PlaceSkippedPayload', PlaceSkippedPayload],
  ['NarrationGeneratedPayload', NarrationGeneratedPayload],
  ['NarrationCompletedPayload', NarrationCompletedPayload],
  ['GoNowTriggeredPayload', GoNowTriggeredPayload],
  ['ClosedReportedPayload', ClosedReportedPayload],
  ['PriceCorrectedPayload', PriceCorrectedPayload],
  ['PlanRegeneratedPayload', PlanRegeneratedPayload],
  ['DayFeedbackPayload', DayFeedbackPayload],
  ['ListFinalizedPayload', ListFinalizedPayload],
  // solver worker seam (§8)
  ['SolverAnchor', SolverAnchor],
  ['SolverOpeningWindow', SolverOpeningWindow],
  ['SolverCandidate', SolverCandidate],
  ['SolverDay', SolverDay],
  ['SolverTravelEdge', SolverTravelEdge],
  ['SolverRequest', SolverRequest],
  ['SolverTravelLeg', SolverTravelLeg],
  ['SolverScheduledStop', SolverScheduledStop],
  ['SolverDaySchedule', SolverDaySchedule],
  ['SolverResponse', SolverResponse],
  // research API request/response + SSE shapes (§7, §11)
  ['ResearchRequest', ResearchRequest],
  ['ResearchResult', ResearchResult],
  ['ResearchStageStarted', ResearchStageStarted],
  ['ResearchStageLog', ResearchStageLog],
  ['ResearchPlaceFound', ResearchPlaceFound],
  ['ResearchCandidateScored', ResearchCandidateScored],
  ['ResearchStageCompleted', ResearchStageCompleted],
  ['ResearchCompleted', ResearchCompleted],
  ['SseError', SseError],
  ['ResearchStreamMessage', ResearchStreamMessage],
];

/** Recursively sort object keys so serialized output is byte-stable across runs. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pythonDir = join(scriptDir, '..', 'python');
const schemaDir = join(pythonDir, 'jsonschema');
const modelDir = join(pythonDir, 'intown_contracts');
const venvCodegen = join(scriptDir, '..', '..', '.venv', 'bin', 'datamodel-codegen');

function main(): void {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of ENTRIES) registry.add(schema, { id });

  const { schemas } = z.toJSONSchema(registry, {
    uri: (id) => `${id}.json`,
  }) as { schemas: Record<string, unknown> };

  // Fresh JSON Schema dir every run (drop stale files).
  rmSync(schemaDir, { recursive: true, force: true });
  mkdirSync(schemaDir, { recursive: true });

  for (const id of Object.keys(schemas).sort()) {
    // `title` drives the generated pydantic class name (`--use-title-as-name`),
    // so each module exposes e.g. `class Poi` rather than a generic `class Model`.
    const schema = { title: id, ...(schemas[id] as Record<string, unknown>) };
    const json = JSON.stringify(sortKeys(schema), null, 2) + '\n';
    writeFileSync(join(schemaDir, `${id}.json`), json, 'utf8');
  }
  console.log(`Wrote ${Object.keys(schemas).length} JSON Schema files to ${schemaDir}`);

  // Regenerate pydantic models. Fresh dir so removed schemas don't linger.
  rmSync(modelDir, { recursive: true, force: true });
  mkdirSync(modelDir, { recursive: true });

  const args = [
    '--input', schemaDir,
    '--input-file-type', 'jsonschema',
    '--output-model-type', 'pydantic_v2.BaseModel',
    '--target-python-version', '3.11',
    '--output', modelDir,
    '--disable-timestamp',
    '--use-title-as-name',
    '--use-standard-collections',
    '--formatters', 'black', '--formatters', 'isort',
  ];
  const res = spawnSync(venvCodegen, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`datamodel-codegen failed (status ${res.status ?? 'null'}, signal ${res.signal ?? 'null'})`);
  }
  console.log('Generated pydantic models in', modelDir);
  console.log('Model files:', readdirSync(modelDir).sort().join(', '));
}

main();
