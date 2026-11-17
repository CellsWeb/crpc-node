import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const cli = path.join(packageDir, 'bin/create.js');
const probe = fileURLToPath(new URL('./support/docs-probe.mjs', import.meta.url));
const loader = import.meta.resolve('tsx');
const adapters = ['bun', 'elysia', 'express', 'fastify', 'hono', 'node', 'ultimate-express'];
const cases = [
  { name: 'development default', raw: {}, enabled: true, nodeEnv: 'development', parsed: false },
  { name: 'development false retains default-template policy', raw: { NODE_ENV: 'development', API_DOCS_ENABLED: 'false' }, enabled: true, nodeEnv: 'development', parsed: false },
  { name: 'production default', raw: { NODE_ENV: 'production' }, enabled: false, nodeEnv: 'production', parsed: false },
  { name: 'production true', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: 'true' }, enabled: true, nodeEnv: 'production', parsed: true },
  { name: 'production false', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: 'false' }, enabled: false, nodeEnv: 'production', parsed: false },
  { name: 'production one', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: '1' }, enabled: true, nodeEnv: 'production', parsed: true },
  { name: 'production zero', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: '0' }, enabled: false, nodeEnv: 'production', parsed: false },
  { name: 'production uppercase true', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: ' TRUE ' }, enabled: true, nodeEnv: 'production', parsed: true },
  { name: 'production invalid falls back to false', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: 'invalid' }, enabled: false, nodeEnv: 'production', parsed: false },
  { name: 'production dotenv enablement', raw: {}, dotenv: 'NODE_ENV=production\nAPI_DOCS_ENABLED=true\n', enabled: true, nodeEnv: 'production', parsed: true },
  { name: 'process environment overrides dotenv', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: 'false' }, dotenv: 'NODE_ENV=development\nAPI_DOCS_ENABLED=true\n', enabled: false, nodeEnv: 'production', parsed: false },
  { name: 'explicit docs true overrides production false', raw: { NODE_ENV: 'production', API_DOCS_ENABLED: 'false' }, override: true, enabled: true, nodeEnv: 'production', parsed: false },
  { name: 'explicit docs false overrides development true', raw: { NODE_ENV: 'development', API_DOCS_ENABLED: 'true' }, override: false, enabled: false, nodeEnv: 'development', parsed: true },
];

for (const adapter of adapters) {
  test(`${adapter}: generated environment guard and HTTP docs`, async t => {
    const project = mkdtempSync(path.join(os.tmpdir(), `crpc008-${adapter}-`));
    try {
      const generated = spawnSync(process.execPath, [cli, project, `--framework=${adapter}`, '--yes', '--skip-install'], { encoding: 'utf8' });
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      const source = readFileSync(path.join(project, 'src/server.ts'), 'utf8');
      assert.match(source, /import\s*\{\s*env\s*\}\s*from\s*["']\.\/env["']/);
      symlinkSync(path.join(packageDir, 'node_modules'), path.join(project, 'node_modules'), 'dir');

      for (const scenario of cases) {
        await t.test(scenario.name, () => {
          writeFileSync(path.join(project, '.env'), scenario.dotenv ?? '');
          const childEnv = { ...process.env };
          for (const key of ['NODE_ENV', 'API_DOCS_ENABLED', 'API_DOCS_ENDPOINT', 'API_RPC_ENDPOINT', 'API_HEALTH_ENDPOINT', 'DOTENV_CONFIG_PATH', 'DOTENV_CONFIG_OVERRIDE']) delete childEnv[key];
          Object.assign(childEnv, scenario.raw, { API_LOG_LEVEL: 'fatal', DOTENV_CONFIG_QUIET: 'true' });
          const child = spawnSync(process.execPath, ['--import', loader, probe, project, JSON.stringify(scenario.override ?? null)], {
            cwd: project, env: childEnv, encoding: 'utf8', timeout: 15_000,
          });
          assert.equal(child.status, 0, child.stderr || child.stdout);
          const observed = JSON.parse(child.stdout.trim());
          assert.equal(observed.nodeEnv, scenario.nodeEnv);
          assert.equal(observed.parsed, scenario.parsed);
          assert.equal(observed.parsedType, 'boolean', 'generated env must parse raw strings');
          assert.equal(observed.docsStatus, scenario.enabled ? 200 : 404, JSON.stringify(observed));
          assert.equal(observed.contentExposed, scenario.enabled);
          assert.equal(observed.disabledRoutesBlocked, !scenario.enabled);
          assert.equal(observed.rpcStatus, 'ok', 'docs configuration must not disable execution');
          assert.equal(observed.registered, 2, 'badge values must not affect registry membership');
          if (scenario.enabled) {
            assert.equal(observed.privateBadge, false);
            assert.equal(observed.publicBadge, false);
            assert.equal(observed.detailSchema, true);
          }
        });
      }
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
}
