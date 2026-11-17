import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { before, test } from 'node:test';
import Fastify from 'fastify';
import { Type } from '@sinclair/typebox';
import { command, repo } from './support/generated-project.mjs';

let CoreRPC, File;
before(async () => {
  const built = command(repo, 'pnpm', ['--filter', '@cellsweb/rpc-core', 'build']);
  assert.equal(built.status, 0, built.stdout + built.stderr);
  ({ CoreRPC, File } = await import('../../rpc-core/dist/index.js'));
});
async function fixture(t, existing = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crpc013-'));
  const app = new CoreRPC({ functionsDir: dir, middlewaresDir: dir, docs: false });
  const registry = await app.getRegistry();
  registry.functions.set('probe.upload', { key: 'probe.upload', namespace: 'probe', functionName: 'upload', filePath: '/fixture',
    contentType: 'multipart/form-data', middlewares: [], inputSchema: Type.Object({ file: File() }),
    run: async input => ({ hex: (await input.file.toBuffer()).toString('hex') }) });
  registry.functions.set('probe.json', { key: 'probe.json', namespace: 'probe', functionName: 'json', filePath: '/fixture',
    contentType: 'application/json', middlewares: [], run: async input => input });
  const fastify = Fastify({ bodyLimit: 128 });
  let parserCalls = 0;
  if (existing) fastify.addContentTypeParser('multipart/form-data', (_request, _payload, done) => { parserCalls++; done(null); });
  fastify.post('/outside', async () => ({ outside: true }));
  await fastify.register(app.createFastifyPlugin());
  const base = await fastify.listen({ port: 0, host: '127.0.0.1' });
  t.after(async () => { await fastify.close(); await app.close(); fs.rmSync(dir, { force: true, recursive: true }); });
  return { base, parserCalls: () => parserCalls };
}
function form() {
  const body = new FormData(); body.append('namespace', 'probe'); body.append('functionName', 'upload');
  body.append('file', new Blob([Buffer.alloc(256, 0xfe)]), 'file.bin'); return body;
}
test('Fastify multipart streams bypass its JSON body buffering and stay inside plugin scope', async t => {
  const f = await fixture(t);
  const response = await fetch(f.base + '/rpc', { method: 'POST', body: form() });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.hex, Buffer.alloc(256, 0xfe).toString('hex'));
  const outside = await fetch(f.base + '/outside', { method: 'POST', body: form() });
  assert.equal(outside.status, 415, 'parser must not leak to sibling routes');
});
test('Fastify existing multipart parser remains in control without duplicate registration', async t => {
  const f = await fixture(t, true);
  const response = await fetch(f.base + '/rpc', { method: 'POST', body: form() });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.hex, Buffer.alloc(256, 0xfe).toString('hex'));
  assert.equal(f.parserCalls(), 1);
});
test('Fastify normal JSON parser and JSON body limit are preserved', async t => {
  const f = await fixture(t);
  for (const [data, status] of [[{ text: 'small' }, 200], [{ text: 'x'.repeat(512) }, 413]]) {
    const response = await fetch(f.base + '/rpc', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ namespace: 'probe', functionName: 'json', data }) });
    assert.equal(response.status, status);
    if (status === 200) assert.deepEqual((await response.json()).data, data);
  }
});
test('Fastify hands off before EOF: CRPC rejects a file limit on an unfinished streamed body', async t => {
  const previous = process.env.MAX_UPLOAD_FILE_BYTES;
  process.env.MAX_UPLOAD_FILE_BYTES = '1024';
  t.after(() => { if (previous === undefined) delete process.env.MAX_UPLOAD_FILE_BYTES; else process.env.MAX_UPLOAD_FILE_BYTES = previous; });
  const f = await fixture(t);
  const prefix = '--stream\r\nContent-Disposition: form-data; name="namespace"\r\n\r\nprobe\r\n--stream\r\nContent-Disposition: form-data; name="functionName"\r\n\r\nupload\r\n--stream\r\nContent-Disposition: form-data; name="file"; filename="large.bin"\r\nContent-Type: application/octet-stream\r\n\r\n';
  const result = await new Promise((resolve, reject) => {
    const request = http.request(f.base + '/rpc', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=stream', 'content-length': 100_000 } }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => { request.destroy(); resolve({ status: response.statusCode, body: JSON.parse(body) }); });
    });
    request.on('error', () => {});
    const timer = setTimeout(() => { request.destroy(); reject(new Error('Parser buffered or waited for full body')); }, 1500);
    t.after(() => { clearTimeout(timer); request.destroy(); });
    request.write(Buffer.concat([Buffer.from(prefix), Buffer.alloc(2048)])); // Intentionally never end the body.
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.code, 'payload_too_large');
});
