import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { adapters, addProbeFunctions, command, generatedProject, repo } from './support/generated-project.mjs';

const probe = fileURLToPath(new URL('./support/adapter-probe.mjs', import.meta.url));
const loader = import.meta.resolve('tsx');
const bun = process.env.BUN_BIN ?? 'bun';
const hasBun = spawnSync(bun, ['--version'], { encoding: 'utf8' }).status === 0;

before(() => {
  const build = command(repo, 'pnpm', ['--filter', '@cellsweb/rpc-core', 'build']);
  assert.equal(build.status, 0, build.stderr || build.stdout);
});

for (const adapter of adapters) {
  test(`${adapter}: complete generated project compiles and serves HTTP`, async t => {
    const project = generatedProject(adapter);
    t.after(() => rmSync(project, { recursive: true, force: true }));
    addProbeFunctions(project);
    if (adapter === 'ultimate-express') {
      // Keep the exact public factory return type, including uwsApp and listen's
      // specialized return value. A broad Express or any annotation loses this.
      writeFileSync(path.join(project, 'src/server-type-probe.ts'), `import express from 'ultimate-express';
import { server } from './server';
type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type Typed = Assert<IsAny<typeof server> extends false ? true : false>;
type Factory = ReturnType<typeof express>;
type Preserved = Assert<Factory extends typeof server ? typeof server extends Factory ? true : false : false>;
export const nativeApp: Factory['uwsApp'] = server.uwsApp;
export type Listener = ReturnType<typeof server.listen>['uwsApp'];
`);
    }

    await t.test('strict typecheck', () => {
      const result = command(project, 'npm', ['run', 'typecheck']);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    });
    await t.test('production build including declarations', () => {
      const result = command(project, 'npm', ['run', 'build']);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const declaration = readFileSync(path.join(project, 'dist/server.d.ts'), 'utf8');
      assert.match(declaration, /export declare const app: CoreRPC/);
      if (adapter === 'ultimate-express') assert.match(declaration, /server: ReturnType<typeof express>/);
    });

    for (const [nodeEnv, docs] of [['development', undefined], ['production', undefined], ['production', 'true'], ['production', 'false']]) {
      await t.test(`HTTP ${nodeEnv} docs=${docs ?? 'omitted'}`, { skip: ['bun', 'elysia'].includes(adapter) && !hasBun ? 'Bun runtime required; compilation still tested' : false }, () => {
        const env = { ...process.env, NODE_ENV: nodeEnv, VITEST: '1', API_HOST: '127.0.0.1', API_PORT: '0', API_LOG_LEVEL: 'fatal', DOTENV_CONFIG_QUIET: 'true' };
        for (const key of ['API_DOCS_ENABLED', 'API_DOCS_ENDPOINT', 'API_RPC_ENDPOINT', 'API_HEALTH_ENDPOINT', 'DOTENV_CONFIG_PATH', 'DOTENV_CONFIG_OVERRIDE', 'UPLOAD_MODE', 'UPLOAD_DIR']) delete env[key];
        if (docs !== undefined) env.API_DOCS_ENABLED = docs;
        const runtime = ['bun', 'elysia'].includes(adapter) ? bun : process.execPath;
        const args = [...(runtime === process.execPath ? ['--import', loader] : []), probe, project, adapter, String(nodeEnv !== 'production' || docs === 'true')];
        const result = spawnSync(runtime, args, { cwd: project, env, encoding: 'utf8', timeout: 20_000 });
        assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
        assert.match(result.stdout, /HTTP JSON\/errors\/binary\/docs PASS/);
        assert.match(result.stdout, /MULTIPART binary fidelity PASS/);
      });
    }
  });
}
