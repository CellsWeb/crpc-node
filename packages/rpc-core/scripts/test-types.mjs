import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately test the packed public declarations with clean consumer dependencies,
// rather than the workspace's transitive dependency versions or symlink resolution.
const core = fileURLToPath(new URL('..', import.meta.url));
const project = mkdtempSync(path.join(os.tmpdir(), 'crpc-consumer-types-'));
const manifest = JSON.parse(readFileSync(path.join(core, 'package.json'), 'utf8'));
try {
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', project], { cwd: core, encoding: 'utf8' }));
  writeFileSync(path.join(project, 'package.json'), JSON.stringify({ private: true, dependencies: {
    '@cellsweb/rpc-core': 'file:./' + packed.filename,
    '@types/node': manifest.devDependencies['@types/node'],
    typescript: manifest.devDependencies.typescript,
  } }));
  execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: project, stdio: 'inherit' });
  for (const file of ['consumer-types.mts', 'consumer-types.cts']) copyFileSync(path.join(core, 'test', file), path.join(project, file));
  execFileSync(process.execPath, [path.join(project, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'NodeNext', '--target', 'ES2022', '--types', 'node', 'consumer-types.mts', 'consumer-types.cts'], { cwd: project, stdio: 'inherit' });
  console.log('Strict packed ESM/CommonJS public TypeBox helper declarations PASS');
} finally {
  rmSync(project, { recursive: true, force: true });
}
