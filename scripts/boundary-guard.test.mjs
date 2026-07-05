import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const guard = path.join(scriptDir, 'boundary-guard.mjs');
const repoRoot = path.resolve(scriptDir, '..');

function runGuardCli(root) {
  return spawnSync(process.execPath, [guard, '--root', root], { encoding: 'utf8' });
}

test('fails on a seeded cross-boundary import', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'boundary-guard-bad-'));
  try {
    // A frontend source file that reaches into the backend package — a violation.
    mkdirSync(path.join(root, 'frontend', 'src'), { recursive: true });
    mkdirSync(path.join(root, 'backend', 'api', 'src'), { recursive: true });
    writeFileSync(
      path.join(root, 'frontend', 'src', 'leak.ts'),
      "import { createServer } from '@intown/api';\nexport const x = createServer;\n",
    );
    // And a relative escape from backend into frontend.
    writeFileSync(
      path.join(root, 'backend', 'api', 'src', 'leak.ts'),
      "import { App } from '../../../frontend/src/App';\nexport const y = App;\n",
    );

    const result = runGuardCli(root);
    assert.notEqual(result.status, 0, 'guard should exit non-zero on a violation');
    assert.match(result.stderr, /boundary violation/i);
    assert.match(result.stderr, /frontend\/src\/leak\.ts/);
    assert.match(result.stderr, /@intown\/api/);
    assert.match(result.stderr, /backend\/api\/src\/leak\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails on a seeded cross-boundary package.json dependency', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'boundary-guard-pkg-'));
  try {
    mkdirSync(path.join(root, 'frontend'), { recursive: true });
    writeFileSync(
      path.join(root, 'frontend', 'package.json'),
      JSON.stringify(
        { name: '@intown/frontend', dependencies: { '@intown/api': 'workspace:*' } },
        null,
        2,
      ),
    );
    const result = runGuardCli(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /package\.json/);
    assert.match(result.stderr, /@intown\/api/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('passes on the clean real repo tree', () => {
  const result = runGuardCli(repoRoot);
  assert.equal(result.status, 0, `guard should pass on the real repo; stderr:\n${result.stderr}`);
  assert.match(result.stdout, /OK/);
});

test('allows importing the contracts seam from both apps', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'boundary-guard-ok-'));
  try {
    mkdirSync(path.join(root, 'frontend', 'src'), { recursive: true });
    mkdirSync(path.join(root, 'backend', 'api', 'src'), { recursive: true });
    writeFileSync(
      path.join(root, 'frontend', 'src', 'ok.ts'),
      "import { Poi } from '@intown/contracts/types';\nexport type T = Poi;\n",
    );
    writeFileSync(
      path.join(root, 'backend', 'api', 'src', 'ok.ts'),
      "import { Poi } from '@intown/contracts/types';\nexport type T = Poi;\n",
    );
    const result = runGuardCli(root);
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
