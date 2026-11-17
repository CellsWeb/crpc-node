import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// JavaScript stays CommonJS for both entrypoints. Separate declarations let
// TypeBox's conditional unique-symbol types match each consumer's module mode.
function importSpecifier(file, relative) {
  const stem = relative.replace(/\.js$/, '');
  const target = path.resolve(path.dirname(file), stem);
  if (existsSync(target + '.d.ts')) return stem + '.mjs';
  if (existsSync(path.join(target, 'index.d.ts'))) return stem + '/index.mjs';
  throw new Error('Missing declaration target for ' + relative + ' in ' + file);
}
const root = fileURLToPath(new URL('../dist', import.meta.url));
function emit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { emit(file); continue; }
    if (!file.endsWith('.d.ts')) continue;
    let content = readFileSync(file, 'utf8').replace(
      /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.[^"']+)\2/g,
      (_match, prefix, quote, relative) => prefix + quote + importSpecifier(file, relative) + quote,
    );
    if (file === path.join(root, 'index.d.ts')) {
      // Native ESM import of CommonJS also exposes its existing default object.
      content += '\ndeclare const api: Omit<typeof import("./index.mjs"), "default">;\nexport default api;\n';
    }
    writeFileSync(file.replace(/\.d\.ts$/, '.d.mts'), content);
  }
}
emit(root);
