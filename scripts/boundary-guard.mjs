#!/usr/bin/env node
/**
 * Boundary guard (§18.3, P00 acceptance criterion 6).
 *
 * The two apps never import each other; the only shared code is `contracts/`.
 * This guard enforces that seam at the source level so a stray import can never
 * silently couple `frontend/` to `backend/` (or vice-versa).
 *
 * What it flags, for every source file under `frontend/` and `backend/`
 * (extensions ts/tsx/mts/mjs/js; `node_modules`, `dist`, `dev-dist` skipped):
 *   1. A relative import/require/dynamic-import whose resolved path escapes into
 *      the OTHER app's tree (e.g. a `frontend/` file reaching `../../backend/…`).
 *   2. A bare specifier crossing the seam: `@intown/api` (or a subpath) imported
 *      from `frontend/`, or `@intown/frontend` imported from `backend/`.
 *   3. A `package.json` under one app declaring a dependency on the other app's
 *      workspace package (`@intown/api` in a `frontend/` manifest, or
 *      `@intown/frontend` in a `backend/` manifest).
 *
 * Importing `@intown/contracts` (the seam) from either app is allowed.
 *
 * Zero runtime dependencies — plain Node, so it runs before install finishes if
 * needed. Exits non-zero with a `file:line: message` report on any violation,
 * and exits 0 (with a one-line OK) on a clean tree.
 *
 * Usage:
 *   node scripts/boundary-guard.mjs                # scan this repo
 *   node scripts/boundary-guard.mjs --root <dir>   # scan an arbitrary tree (tests)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.cts', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dev-dist', '.git', 'coverage']);

/** The two app trees and the workspace package each one must never reach. */
const APPS = [
  { name: 'frontend', dir: 'frontend', forbiddenPackage: '@intown/api' },
  { name: 'backend', dir: 'backend', forbiddenPackage: '@intown/frontend' },
];

/** Resolve the repo root: `--root <dir>`, else the parent of this `scripts/` dir. */
function resolveRoot(argv) {
  const flagIndex = argv.indexOf('--root');
  if (flagIndex !== -1) {
    const value = argv[flagIndex + 1];
    if (!value) {
      console.error('boundary-guard: --root requires a directory argument');
      process.exit(2);
    }
    return path.resolve(value);
  }
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, '..');
}

/** Recursively collect files under `dir` that match `predicate`. */
function walk(dir, predicate, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), predicate, out);
    } else if (entry.isFile()) {
      const full = path.join(dir, entry.name);
      if (predicate(full, entry.name)) out.push(full);
    }
  }
  return out;
}

/** Extract every module specifier from source text, with 1-based line numbers. */
function extractSpecifiers(text) {
  const patterns = [
    // import x from 'y' / export … from 'y' / export * from 'y'
    /(?:^|[^.\w$])(?:import|export)\b[^;'"`]*?\bfrom\s*['"]([^'"]+)['"]/g,
    // side-effect import: import 'y'
    /(?:^|[^.\w$])import\s+['"]([^'"]+)['"]/g,
    // dynamic import: import('y')
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // require('y')
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const found = new Map(); // key `spec@index` -> { specifier, index }
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const specifier = match[1];
      // Anchor the index at the quoted string so line numbers point at the spec.
      const index = match.index + match[0].lastIndexOf(specifier);
      found.set(`${specifier}@${index}`, { specifier, index });
    }
  }
  return [...found.values()];
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function isRelative(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier === '.' || specifier === '..';
}

function matchesPackage(specifier, pkg) {
  return specifier === pkg || specifier.startsWith(`${pkg}/`);
}

/** Return the app whose tree contains `absPath`, or null. */
function appOf(absPath, root) {
  for (const app of APPS) {
    const appRoot = path.join(root, app.dir);
    if (absPath === appRoot || absPath.startsWith(appRoot + path.sep)) return app;
  }
  return null;
}

function checkSourceFiles(root, violations) {
  for (const app of APPS) {
    const appRoot = path.join(root, app.dir);
    if (!existsSync(appRoot)) continue;
    const other = APPS.find((a) => a !== app);
    const otherRoot = path.join(root, other.dir);
    const files = walk(appRoot, (_full, name) => SOURCE_EXTENSIONS.has(path.extname(name)));

    for (const file of files) {
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const rel = path.relative(root, file);
      for (const { specifier, index } of extractSpecifiers(text)) {
        if (isRelative(specifier)) {
          const resolved = path.resolve(path.dirname(file), specifier);
          if (resolved === otherRoot || resolved.startsWith(otherRoot + path.sep)) {
            violations.push({
              file: rel,
              line: lineOf(text, index),
              message: `relative import '${specifier}' escapes into the ${other.name}/ tree`,
            });
          }
        } else if (matchesPackage(specifier, app.forbiddenPackage)) {
          violations.push({
            file: rel,
            line: lineOf(text, index),
            message: `${app.name}/ must not import '${specifier}' (the ${other.name} package)`,
          });
        }
      }
    }
  }
}

function checkManifests(root, violations) {
  for (const app of APPS) {
    const appRoot = path.join(root, app.dir);
    if (!existsSync(appRoot)) continue;
    const manifests = walk(appRoot, (_full, name) => name === 'package.json');
    for (const manifest of manifests) {
      let parsed;
      let raw;
      try {
        raw = readFileSync(manifest, 'utf8');
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const rel = path.relative(root, manifest);
      const depSections = [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ];
      for (const section of depSections) {
        const deps = parsed[section];
        if (!deps || typeof deps !== 'object') continue;
        for (const depName of Object.keys(deps)) {
          if (matchesPackage(depName, app.forbiddenPackage)) {
            // Point at the line declaring the dependency.
            const lines = raw.split('\n');
            let lineNo = 1;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(`"${depName}"`)) {
                lineNo = i + 1;
                break;
              }
            }
            violations.push({
              file: rel,
              line: lineNo,
              message: `${app.name}/ package.json (${section}) must not depend on '${depName}'`,
            });
          }
        }
      }
    }
  }
}

/** Programmatic entrypoint — returns the violation list (empty === clean). */
export function runGuard(root) {
  const violations = [];
  checkSourceFiles(root, violations);
  checkManifests(root, violations);
  return violations;
}

function main() {
  const root = resolveRoot(process.argv.slice(2));
  const violations = runGuard(root);
  if (violations.length > 0) {
    console.error(`boundary-guard: ${violations.length} boundary violation(s) found:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}: ${v.message}`);
    }
    process.exit(1);
  }
  console.log('boundary-guard: OK — frontend/ and backend/ are decoupled (contracts/ is the only seam).');
}

// Only run the CLI when invoked directly, not when imported by the test.
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();

export { appOf };
