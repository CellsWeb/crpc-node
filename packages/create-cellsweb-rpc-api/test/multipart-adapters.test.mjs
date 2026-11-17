import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { adapters, addProbeFunctions, command, generatedProject, repo } from './support/generated-project.mjs';

const probe = fileURLToPath(new URL('./support/multipart-probe.mjs', import.meta.url));
const loader = import.meta.resolve('tsx');
const bun = process.env.BUN_BIN ?? 'bun';
const hasBun = spawnSync(bun, ['--version']).status === 0;
before(() => {
  const result = command(repo, 'pnpm', ['--filter', '@cellsweb/rpc-core', 'build']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const adapter of adapters) {
  test(`${adapter}: live multipart compatibility, interruption and cleanup`, { skip: ['bun', 'elysia'].includes(adapter) && !hasBun ? 'Bun required' : false }, t => {
    const project = generatedProject(adapter);
    t.after(() => rmSync(project, { recursive: true, force: true }));
    addProbeFunctions(project);
    const dir = path.join(project, 'src/functions/probe/array');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'constants.ts'), `import { Type } from '@sinclair/typebox';
import { Files } from '@cellsweb/rpc-core';
export const contentType = 'multipart/form-data';
export const inputSchema = Type.Object({ title: Type.String(), file: Files() });`);
    writeFileSync(path.join(dir, 'run.ts'), `import type { UploadedFile } from '@cellsweb/rpc-core';
export async function run(input: { title: string; file: UploadedFile[] }) {
  return { title: input.title, files: await Promise.all(input.file.map(async file => ({
    name: file.filename, hex: (await file.toBuffer()).toString('hex'), size: file.byteLength,
    declared: file.declaredMimeType, detected: file.detectedMimeType
  }))) };
}`);
    const runtime = ['bun', 'elysia'].includes(adapter) ? bun : process.execPath;
    const env = { ...process.env, NODE_ENV: 'test', VITEST: '1', API_LOG_LEVEL: 'fatal', DOTENV_CONFIG_QUIET: 'true',
      MAX_UPLOAD_FILE_BYTES: '1024', MAX_MULTIPART_BYTES: '4096', UPLOAD_TMP_DIR: path.join(project, 'upload-tmp') };
    for (const key of ['API_RPC_ENDPOINT', 'API_DOCS_ENDPOINT', 'API_HEALTH_ENDPOINT']) delete env[key];
    const args = [...(runtime === process.execPath ? ['--import', loader] : []), probe, project, adapter];
    const result = spawnSync(runtime, args, { cwd: project, env, encoding: 'utf8', timeout: 40_000 });
    t.diagnostic(result.stdout.trim());
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  });
}
