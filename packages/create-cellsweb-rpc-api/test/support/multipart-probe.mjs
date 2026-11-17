import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [project, adapter] = process.argv.slice(2);
const module = await import(pathToFileURL(path.join(project, 'src/server.ts')).href);
const { app, server } = module;
const { AppError, ErrorCode } = await import(pathToFileURL(path.join(project, 'node_modules/@cellsweb/rpc-core/dist/index.js')).href);
const registry = await app.getRegistry();
const trace = [], requests = [], pendingTimers = new Set();
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
// Track only CRPC's bounded multipart error-drain timers.
globalThis.setTimeout = (callback, ms, ...args) => {
  let timer;
  timer = originalSetTimeout(() => { pendingTimers.delete(timer); callback(...args); }, ms);
  if (ms === 2000) pendingTimers.add(timer);
  return timer;
};
globalThis.clearTimeout = timer => { pendingTimers.delete(timer); originalClearTimeout(timer); };
registry.middlewares.set('probeAuth', { name: 'probeAuth', filePath: '/probe', run: async ({ headers }, context) => {
  trace.push('auth');
  if (headers.authorization !== 'Bearer allowed') throw new AppError(ErrorCode.UNAUTHORIZED, 'Probe denied');
  if (context.req?.on) {
    const req = context.req, socket = typeof req.socket?.on === 'function' ? req.socket : req.res?.socket;
    const record = { req, socket, events: [], initialComplete: req.complete, initialEnded: req.readableEnded };
    for (const name of ['end', 'close', 'aborted']) req.once(name, () => record.events.push([name, req.complete, req.readableEnded]));
    requests.push(record);
  }
  return context;
} });
for (const name of ['upload', 'array']) {
  const entry = registry.functions.get(`probe.${name}`), run = entry.run;
  entry.middlewares = [{ name: 'probeAuth', options: {} }];
  entry.run = async (...args) => { trace.push('handler'); return run(...args); };
}

let base, stop;
if (adapter === 'bun') {
  const listener = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: module.fetchHandler });
  base = `http://127.0.0.1:${listener.port}`; stop = () => listener.stop(true);
} else if (adapter === 'elysia') {
  server.listen({ port: 0, hostname: '127.0.0.1' });
  base = `http://127.0.0.1:${server.server.port}`; stop = () => server.stop(true);
} else if (adapter === 'hono') {
  const { serve } = await import(pathToFileURL(path.join(project, 'node_modules/@hono/node-server/dist/index.mjs')).href);
  const listener = serve({ fetch: server.fetch, port: 0, hostname: '127.0.0.1' });
  if (!listener.listening) await new Promise(resolve => listener.once('listening', resolve));
  base = `http://127.0.0.1:${listener.address().port}`;
  stop = () => new Promise(resolve => { listener.closeAllConnections(); listener.close(resolve); });
} else if (adapter === 'fastify') {
  base = await server.listen({ port: 0, host: '127.0.0.1' }); stop = () => server.close();
} else {
  let listener;
  await new Promise(resolve => { listener = server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${listener.address().port}`;
  stop = () => new Promise(resolve => { listener.closeAllConnections?.(); listener.close(resolve); });
}
const tmp = process.env.UPLOAD_TMP_DIR;
const tempFiles = () => fs.existsSync(tmp) ? fs.readdirSync(tmp) : [];
async function until(predicate, message, ms = 1500) {
  const end = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(message);
    await new Promise(resolve => originalSetTimeout(resolve, 5));
  }
}
const binary = Buffer.from(Array.from({ length: 256 }, (_, n) => n));
function form({ target = 'upload', files = [binary], ns = 'probe', duplicate = false } = {}) {
  const body = new FormData();
  body.append('namespace', ns); body.append('functionName', target);
  if (duplicate) body.append('namespace', ns);
  body.append('title', 'multipart ✓');
  files.forEach((bytes, n) => body.append('file', new Blob([bytes], { type: 'application/octet-stream' }), `file${n}.bin`));
  return body;
}
function wire(bytes = binary) {
  const boundary = 'crpc-multipart-boundary';
  const fields = [['namespace', 'probe'], ['functionName', 'upload'], ['title', 'multipart ✓']]
    .map(([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`).join('');
  const prefix = Buffer.from(fields + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="file0.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  return { bytes: Buffer.concat([prefix, bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]), prefix, type: `multipart/form-data; boundary=${boundary}` };
}
const headers = (target = 'upload') => ({ authorization: 'Bearer allowed', 'x-crpc-namespace': 'probe', 'x-crpc-function': target });
async function exchange(body, supplied = { authorization: 'Bearer allowed' }) {
  const response = await fetch(base + '/rpc', { method: 'POST', body, headers: supplied, signal: AbortSignal.timeout(5000) });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  await until(() => tempFiles().length === 0, 'temporary files leaked after response');
  return result;
}
function ok(result) {
  assert.equal(result.status, 'ok', JSON.stringify(result));
  assert.deepEqual(result.data, { title: 'multipart ✓', hex: binary.toString('hex'), filename: 'file0.bin' });
}
function error(result, code) { assert.equal(result.status, 'error', JSON.stringify(result)); assert.equal(result.code, code, JSON.stringify(result)); }
let failures = 0, passed = 0;
async function check(name, run) {
  trace.length = 0;
  try { await run(); passed++; console.log(`PASS ${adapter}: ${name}`); }
  catch (err) { failures++; console.error(`FAIL ${adapter}: ${name}: ${err.stack}`); }
}
try {
  await check('valid headerless upload, binary fidelity and middleware order', async () => {
    ok(await exchange(form())); assert.deepEqual(trace, ['auth', 'handler']);
  });
  await check('header-accelerated routing agrees with redundant body', async () => {
    ok(await exchange(form(), headers())); assert.deepEqual(trace, ['auth', 'handler']);
  });
  await check('file arrays retain bytes, filename, size and MIME metadata', async () => {
    const result = await exchange(form({ target: 'array', files: [binary, Buffer.from('second')] }), headers('array'));
    assert.equal(result.status, 'ok', JSON.stringify(result));
    assert.equal(result.data.title, 'multipart ✓');
    assert.deepEqual(result.data.files.sort((a, b) => a.name.localeCompare(b.name)), [binary, Buffer.from('second')].map((bytes, n) => ({
      name: `file${n}.bin`, hex: bytes.toString('hex'), size: bytes.length, declared: 'application/octet-stream', detected: 'application/octet-stream'
    })));
  });
  await check('empty file', async () => {
    const result = await exchange(form({ files: [Buffer.alloc(0)] }), headers());
    assert.equal(result.status, 'ok', JSON.stringify(result)); assert.equal(result.data.hex, '');
  });
  await check('conflicting routing headers/body rejected before handler', async () => {
    error(await exchange(form({ ns: 'other' }), headers()), 'invalid_body'); assert.ok(!trace.includes('handler'));
  });
  await check('duplicate routing fields rejected', async () => {
    error(await exchange(form({ duplicate: true }), headers()), 'invalid_body'); assert.ok(!trace.includes('handler'));
  });
  await check('partial routing headers rejected', async () => {
    error(await exchange(form(), { authorization: 'Bearer allowed', 'x-crpc-namespace': 'probe' }), 'invalid_body'); assert.equal(trace.length, 0);
  });
  await check('header authorization denies before file creation', async () => {
    error(await exchange(form(), { ...headers(), authorization: 'denied' }), 'unauthorized'); assert.deepEqual(trace, ['auth']);
  });
  await check('headerless authorization denies before file creation', async () => {
    error(await exchange(form(), { authorization: 'denied' }), 'unauthorized'); assert.deepEqual(trace, ['auth']);
  });
  await check('malformed boundary', async () => {
    error(await exchange(wire().bytes, { ...headers(), 'content-type': 'multipart/form-data; boundary=wrong-boundary' }), 'invalid_body');
    assert.ok(!trace.includes('handler'));
  });
  await check('oversized file obeys CRPC limit', async () => {
    error(await exchange(form({ files: [Buffer.alloc(2048)] }), headers()), 'payload_too_large'); assert.ok(!trace.includes('handler'));
  });
  await check('aggregate upload size limit', async () => {
    error(await exchange(form({ target: 'array', files: Array.from({ length: 5 }, () => Buffer.alloc(900)) }), headers('array')), 'payload_too_large');
    assert.ok(!trace.includes('handler'));
  });
  await check('premature client disconnect removes partial files and never runs handler', async () => {
    const body = wire();
    const prefix = body.bytes.subarray(0, body.prefix.length + 64);
    await new Promise((resolve, reject) => {
      const client = http.request(base + '/rpc', { method: 'POST', agent: false, headers: { ...headers(), 'content-type': body.type, 'content-length': body.bytes.length } });
      client.on('error', () => {});
      client.write(prefix, async err => {
        if (err) { reject(err); return; }
        await new Promise(done => originalSetTimeout(done, 50));
        client.destroy(); resolve();
      });
    });
    await new Promise(resolve => originalSetTimeout(resolve, 100));
    await until(() => tempFiles().length === 0, 'partial upload files leaked after disconnect');
    assert.ok(!trace.includes('handler'));
  });
  await check('repeated uploads after errors/disconnects', async () => {
    for (let n = 0; n < 5; n++) ok(await exchange(form(), headers()));
  });
  await check('JSON success and validation error remain HTTP200', async () => {
    const json = data => exchange(JSON.stringify({ namespace: 'public', functionName: 'hello', data }), { 'content-type': 'application/json' });
    assert.deepEqual((await json({ name: 'After uploads' })).data, { greeting: 'Hello, After uploads!' });
    error(await json({ name: '' }), 'validation_error');
  });
  await check('settled request/drain listeners and timers cleaned up', async () => {
    await until(() => pendingTimers.size === 0, 'multipart drain timers leaked', 2500);
    for (const { req, socket } of requests) {
      for (const name of ['close', 'error', 'aborted']) {
        assert.ok(req.listeners(name).every(listener => !['onReqClose', 'onReqError', 'onReqAborted'].includes(listener.name)), `request ${name} listener leaked`);
      }
      assert.ok(socket?.listeners?.('close').every(listener => listener.name !== 'onReqClose') ?? true, 'socket listener leaked');
    }
  });
  console.log(`MATRIX ${adapter}: ${passed} passed, ${failures} failed; lifecycle=${JSON.stringify(requests.slice(0, 2).map(({ events, initialComplete, initialEnded }) => ({ initialComplete, initialEnded, events })))}`);
} finally {
  await stop(); await app.close();
  for (const timer of pendingTimers) originalClearTimeout(timer);
  globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout;
}
process.exit(failures ? 1 : 0);
