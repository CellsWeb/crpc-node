// Fresh process per scenario: load the real CLI-generated env module, evaluate
// its actual CoreRPC constructor options, and exercise the unmodified engine.
// Adapter runtimes are covered separately by generated-project smoke checks.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { CoreRPC } from '../../../rpc-core/src/core-rpc.ts';
import { logger } from '../../../rpc-core/src/logger.ts';
import { Type } from '@sinclair/typebox';

logger.level = 'silent';
const [project, rawOverride] = process.argv.slice(2);
const { env } = await import(pathToFileURL(path.join(project, 'src/env.ts')).href);
const source = readFileSync(path.join(project, 'src/server.ts'), 'utf8');
const constructor = source.match(/export const app = new CoreRPC\((\{[\s\S]*?\})\);/);
assert.ok(constructor, 'generated server must instantiate CoreRPC');
const options = vm.runInNewContext(`(${constructor[1]})`, { env });
const override = JSON.parse(rawOverride);
if (override !== null) options.docs = override;
const app = new CoreRPC(options);
const empty = path.join(project, 'empty-registry');
mkdirSync(empty, { recursive: true });
app.useFunctions(empty).useMiddlewares(empty);
const registry = await app.getRegistry();
for (const [name, isPublic] of [['visible', true], ['classified', false]]) {
  registry.functions.set(`catalog.${name}`, {
    key: `catalog.${name}`, namespace: 'catalog', functionName: name, filePath: '/fixture/run.ts',
    contentType: 'application/json', middlewares: [],
    metadata: { isPublic, description: `docs_marker_${name}` },
    inputSchema: Type.Object({}, { description: 'input_schema_marker' }),
    outputSchema: Type.Object({ ok: Type.Boolean() }, { description: 'output_schema_marker' }),
    run: async () => ({ ok: true }),
  });
}
const server = http.createServer(await app.createHandler());
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const root = await fetch(base + '/docs', { signal: AbortSignal.timeout(3000) });
  const html = await root.text();
  const detail = await fetch(base + '/docs/catalog/classified');
  const detailHtml = await detail.text();
  let disabledRoutesBlocked = root.status === 404;
  for (const uri of ['/docs/', '/docs?query=1', '/docs/catalog/classified', '/docs/middlewares/guard', '/docs/schema.json', '/docs/metadata', '/docs/search', '/openapi.json', '/schemas']) {
    const native = await fetch(base + uri, { signal: AbortSignal.timeout(3000) });
    const web = await app.fetch(new Request(base + uri));
    for (const response of [native, web]) {
      const body = await response.text();
      disabledRoutesBlocked &&= response.status === 404 && !/docs_marker_|input_schema_marker|output_schema_marker|<html/.test(body);
    }
  }
  const rpc = await fetch(base + '/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namespace: 'catalog', functionName: 'classified', data: {} }) });
  const result = await rpc.json();
  assert.equal(rpc.status, 200);
  console.log(JSON.stringify({
    nodeEnv: env.NODE_ENV, parsed: env.API_DOCS_ENABLED, parsedType: typeof env.API_DOCS_ENABLED,
    docsStatus: root.status, contentExposed: html.includes('docs_marker_classified'), disabledRoutesBlocked,
    privateBadge: detailHtml.includes('>PRIVATE</span>'), publicBadge: html.includes('>PUBLIC</span>'),
    detailSchema: detailHtml.includes('input_schema_marker') && detailHtml.includes('output_schema_marker'),
    rpcStatus: result.status, registered: registry.functions.size,
  }));
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await app.close();
}
