import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupTempFiles, parseMultipartStream } from "./request/multipart";

const boundary = "lifecycle-boundary";
const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="namespace"\r\n\r\nprobe\r\n--${boundary}\r\nContent-Disposition: form-data; name="functionName"\r\n\r\nupload\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="file.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`);
const body = Buffer.concat([prefix, Buffer.from([0, 255, 128, 1]), Buffer.from(`\r\n--${boundary}--\r\n`)]);
const headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
async function waitFor(predicate: () => boolean) {
  const end = Date.now() + 1000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error("Lifecycle cleanup did not complete");
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
describe("multipart completion and interruption compatibility (CRPC-014)", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "crpc014-"));
    vi.stubEnv("UPLOAD_TMP_DIR", dir);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); fs.rmSync(dir, { force: true, recursive: true }); });

  for (const complete of [undefined, true]) {
    it(`accepts fully ended file stream with complete=${complete} and detaches listeners`, async () => {
      const socket = new EventEmitter();
      const req = Object.assign(Readable.from([body]), { headers, complete, socket });
      const result = await parseMultipartStream(req);
      const file = result.files.file;
      expect(Array.isArray(file)).toBe(false);
      if (Array.isArray(file)) throw new Error("Expected single file");
      expect(await file.toBuffer()).toEqual(Buffer.from([0, 255, 128, 1]));
      expect(req.readableEnded).toBe(true);
      expect(req.listenerCount("error")).toBe(0);
      expect(req.listenerCount("close")).toBe(0);
      expect(req.listenerCount("aborted")).toBe(0);
      expect(socket.listenerCount("close")).toBe(0);
      cleanupTempFiles(result.tempFilesToCleanup);
      await waitFor(() => fs.readdirSync(dir).length === 0);
    });
  }
  it("honors explicit native complete=false even when readableEnded=true", async () => {
    const req = Object.assign(Readable.from([body]), { headers, complete: false });
    await expect(parseMultipartStream(req)).rejects.toMatchObject({ code: "invalid_body" });
    await waitFor(() => fs.readdirSync(dir).length === 0);
  });
  it("aborted event rejects promptly without waiting for end or close", async () => {
    const req = Object.assign(new PassThrough(), { headers });
    const result = parseMultipartStream(req).then(() => "resolved", error => error);
    req.write(prefix);
    req.emit("aborted");
    const error = await Promise.race([result, new Promise(resolve => setTimeout(() => resolve("hung"), 100))]);
    req.destroy();
    expect(error).toMatchObject({ code: "invalid_body" });
    await waitFor(() => fs.readdirSync(dir).length === 0);
  });
  it("Ultimate Express response socket close rejects an incomplete readable and cleans partial files", async () => {
    const socket = new EventEmitter();
    const req = Object.assign(new PassThrough(), { headers, socket: { remoteAddress: "127.0.0.1" }, res: { socket } });
    const result = parseMultipartStream(req).then(() => "resolved", error => error);
    req.write(Buffer.concat([prefix, Buffer.alloc(64)]));
    await waitFor(() => fs.readdirSync(dir).length === 1);
    socket.emit("close");
    const error = await Promise.race([result, new Promise(resolve => setTimeout(() => resolve("hung"), 100))]);
    req.destroy();
    expect(error).toMatchObject({ code: "invalid_body" });
    await waitFor(() => fs.readdirSync(dir).length === 0);
    expect(socket.listenerCount("close")).toBe(0);
  });
  it("abort while a file is still opening cannot leave a late-created file", async () => {
    const req = Object.assign(Readable.from([body]), { headers, complete: true });
    await expect(parseMultipartStream(req, 4096, 1)).rejects.toMatchObject({ code: "payload_too_large" });
    // Allow fs.open/close to finish: an immediate empty-directory assertion
    // alone would miss a file created after the first unlink attempt.
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(fs.readdirSync(dir)).toEqual([]);
  });
  it("file limit reached during async authorization is not missed", async () => {
    const req = Object.assign(Readable.from([body]), { headers, complete: true });
    await expect(parseMultipartStream(req, 4096, 1, async () => { await Promise.resolve(); }))
      .rejects.toMatchObject({ code: "payload_too_large" });
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(fs.readdirSync(dir)).toEqual([]);
  });
  it("disconnect during async pre-file authorization cannot create a file after settlement", async () => {
    const socket = new EventEmitter();
    const req = Object.assign(new PassThrough(), { headers, socket });
    let release!: () => void;
    const auth = new Promise<void>(resolve => { release = resolve; });
    let entered = false;
    const result = parseMultipartStream(req, undefined, undefined, async () => { entered = true; await auth; })
      .then(() => "resolved", error => error);
    req.write(body);
    await waitFor(() => entered);
    socket.emit("close");
    const error = await Promise.race([result, new Promise(resolve => setTimeout(() => resolve("hung"), 100))]);
    release();
    req.destroy();
    expect(error).toMatchObject({ code: "invalid_body" });
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(fs.readdirSync(dir)).toEqual([]);
  });
  it("already-ended malformed body does not retain a drain timer or listeners", async () => {
    const timer = vi.spyOn(globalThis, "setTimeout");
    const req = Object.assign(Readable.from([Buffer.from("--wrong--\r\n")]), { headers, complete: true });
    await expect(parseMultipartStream(req)).rejects.toMatchObject({ code: "invalid_body" });
    expect(timer.mock.calls.some(([, ms]) => ms === 2000)).toBe(false);
    expect(req.listenerCount("close")).toBe(0);
    expect(req.listenerCount("error")).toBe(0);
  });
});
