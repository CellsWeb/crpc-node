import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [project, adapter, rawDocs] = process.argv.slice(2);
const docs = rawDocs === 'true';
// Exercise emitted JavaScript, not a reconstructed adapter or isolated snippet.
const module = await import(pathToFileURL(path.join(project, 'dist/server.js')).href);
const { app, server } = module;
const storageModule = await import(pathToFileURL(path.join(project, 'dist/utils/storage.js')).href);
const originalServe = storageModule.storage.serve;
const bytes = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
const sliced = Buffer.concat([Buffer.from('prefix'), bytes, Buffer.from('suffix')]).subarray(6, 262);
storageModule.storage.serve = async file => file === 'sliced.bin'
  ? { buffer: sliced, mimeType: 'application/octet-stream' } : originalServe(file);
mkdirSync(path.join(project, 'public/uploads'), { recursive: true });
writeFileSync(path.join(project, 'public/uploads/disk.bin'), bytes);

let base, stop;
if (adapter === 'bun') {
  const listener = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: module.fetchHandler });
  base = `http://127.0.0.1:${listener.port}`;
  stop = () => listener.stop(true);
} else if (adapter === 'elysia') {
  server.listen({ port: 0, hostname: '127.0.0.1' });
  base = `http://127.0.0.1:${server.server.port}`;
  stop = () => server.stop(true);
} else if (adapter === 'hono') {
  const { serve } = await import(pathToFileURL(path.join(project, 'node_modules/@hono/node-server/dist/index.mjs')).href);
  const listener = serve({ fetch: server.fetch, port: 0, hostname: '127.0.0.1' });
  if (!listener.listening) await new Promise(resolve => listener.once('listening', resolve));
  base = `http://127.0.0.1:${listener.address().port}`;
  stop = () => new Promise(resolve => { listener.closeAllConnections(); listener.close(resolve); });
} else if (adapter === 'fastify') {
  base = await server.listen({ port: 0, host: '127.0.0.1' });
  stop = () => server.close();
} else {
  let listener;
  await new Promise(resolve => { listener = server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${listener.address().port}`;
  stop = () => new Promise(resolve => { listener.closeAllConnections?.(); listener.close(resolve); });
}
const get = uri => fetch(base + uri, { signal: AbortSignal.timeout(5000) });
const rpc = async (namespace, functionName, data) => {
  const response = await fetch(base + '/rpc', { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ namespace, functionName, data }) });
  assert.equal(response.status, 200);
  return response.json();
};
try {
  assert.deepEqual((await rpc('public', 'hello', { name: 'Binary ✓' })).data, { greeting: 'Hello, Binary ✓!' });
  const invalid = await rpc('public', 'hello', { name: '' });
  assert.equal(invalid.status, 'error');
  assert.equal(invalid.code, 'validation_error');
  const denied = await rpc('probe', 'protected', {});
  assert.equal(denied.status, 'error');
  assert.equal(denied.code, 'unauthorized');

  for (const file of ['sliced.bin', 'disk.bin']) {
    const response = await get('/uploads/' + file);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes, 'preserve binary view bounds and all byte values');
  }
  const missing = await get('/uploads/missing.bin');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).status, 'error');

  const form = new FormData();
  form.append('namespace', 'probe'); form.append('functionName', 'upload');
  form.append('title', 'multipart ✓');
  form.append('file', new Blob([bytes], { type: 'application/octet-stream' }), 'payload.bin');
  const uploaded = await fetch(base + '/rpc', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
  const result = await uploaded.json();
  assert.equal(uploaded.status, 200);
  assert.equal(result.status, 'ok', JSON.stringify(result));
  assert.deepEqual(result.data, { title: 'multipart ✓', hex: bytes.toString('hex'), filename: 'payload.bin' });
  console.log('MULTIPART binary fidelity PASS');

  const index = await get('/docs');
  const indexHtml = await index.text();
  assert.equal(index.status, docs ? 200 : 404);
  assert.equal(indexHtml.includes('Sample hello JSON RPC function'), docs);
  for (const uri of ['/docs/public/hello?query=1', '/docs/middlewares/rateLimit?query=1']) {
    const response = await get(uri);
    const html = await response.text();
    assert.equal(response.status, docs ? 200 : 404, uri);
    if (docs) {
      assert.ok(html.includes(uri.includes('middlewares') ? 'windowSeconds' : 'Your full name'), 'detail schema content, not index');
    } else assert.ok(!/Your full name|windowSeconds|binary_fixture_marker/.test(html));
  }
  if (!docs) {
    for (const uri of ['/docs/', '/docs/schema.json', '/docs/metadata', '/docs/search']) {
      const response = await get(uri);
      assert.equal(response.status, 404, uri);
      assert.ok(!/Your full name|windowSeconds|binary_fixture_marker/.test(await response.text()));
    }
  }
  assert.ok((await app.getRegistry()).functions.has('probe.upload'), 'private badge does not hide registration or execution');
  console.log(`${adapter}: HTTP JSON/errors/binary/docs PASS`);
} finally {
  await stop();
  await app.close();
}
// Ultimate Express worker threads and sample rate-limit timers are not owned by
// the adapter. End this isolated probe after listeners and CoreRPC are closed.
process.exit(0);
