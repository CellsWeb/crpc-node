import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageDir = fileURLToPath(new URL('../..', import.meta.url));
export const repo = path.resolve(packageDir, '../..');
export const adapters = ['bun', 'elysia', 'express', 'fastify', 'hono', 'node', 'ultimate-express'];

export function command(project, executable, args) {
  return spawnSync(executable, args, { cwd: project, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, npm_config_offline: 'true' } });
}

export function generatedProject(adapter) {
  const project = mkdtempSync(path.join(os.tmpdir(), `crpc011-${adapter}-`));
  const created = command(project, process.execPath, [path.join(packageDir, 'bin/create.js'), project, `--framework=${adapter}`, '--yes', '--skip-install']);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  // Full CLI-generated source and tsconfig; resolve real dependencies already
  // installed in this workspace. The example supplies the generator's common
  // application dependencies; this package declares the adapter test runtimes.
  // No stubs, source replacements, relaxed compiler options or network installs.
  const manifest = JSON.parse(readFileSync(path.join(project, 'package.json'), 'utf8'));
  const modules = path.join(project, 'node_modules');
  mkdirSync(path.join(modules, '.bin'), { recursive: true });
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    const source = [path.join(repo, 'example/node_modules', name), path.join(packageDir, 'node_modules', name)]
      .find(candidate => existsSync(candidate));
    // Coverage/UI tooling is not imported by src or used by build/typecheck.
    if (!source) {
      assert.ok(['@vitest/coverage-v8', '@vitest/ui'].includes(name), `Missing generated-project test dependency: ${name}`);
      continue;
    }
    const dest = path.join(modules, name);
    mkdirSync(path.dirname(dest), { recursive: true });
    symlinkSync(realpathSync(source), dest, 'dir');
    const pkg = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8'));
    const bins = typeof pkg.bin === 'string' ? { [name.split('/').at(-1)]: pkg.bin } : pkg.bin ?? {};
    for (const [bin, relative] of Object.entries(bins)) {
      const target = path.join(modules, '.bin', bin);
      if (!existsSync(target)) symlinkSync(path.resolve(source, relative), target);
    }
  }
  return project;
}

export function addProbeFunctions(project) {
  const files = {
    'functions/probe/upload/constants.ts': `import { Type } from '@sinclair/typebox';
import { File } from '@cellsweb/rpc-core';
export const metadata = { isPublic: false, description: 'binary_fixture_marker' };
export const contentType = 'multipart/form-data';
export const inputSchema = Type.Object({ title: Type.String(), file: File() });
export const outputSchema = Type.Object({ title: Type.String(), hex: Type.String(), filename: Type.String() });`,
    'functions/probe/upload/run.ts': `import type { UploadedFile } from '@cellsweb/rpc-core';
export async function run(input: { title: string; file: UploadedFile }) {
  return { title: input.title, hex: (await input.file.toBuffer()).toString('hex'), filename: input.file.filename };
}`,
    'functions/probe/protected/constants.ts': `export const metadata = { isPublic: true };`,
    'functions/probe/protected/middlewares.ts': `import { defineMiddlewares } from '@cellsweb/rpc-core';
export const middlewares = defineMiddlewares([{ name: 'auth', options: { roles: ['admin'] } }]);`,
    'functions/probe/protected/run.ts': `export async function run() { return { unexpected: true }; }`,
  };
  for (const [relative, source] of Object.entries(files)) {
    const dest = path.join(project, 'src', relative);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, source);
  }
}
