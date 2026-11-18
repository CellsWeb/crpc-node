import { afterEach, describe, expect, it, vi } from "vitest";
import { createRpcClient, rawRpcRequest } from "./client";

class NativeFormData {
  readonly parts: [string, unknown][] = [];
  append(name: string, value: unknown) { this.parts.push([name, value]); }
  getParts() { return this.parts; }
  getAll(name: string) { return this.parts.filter(([key]) => key === name).map(([, value]) => value); }
}

class TestXHR {
  static instances: TestXHR[] = [];
  static event: "load" | "error" | "timeout" | "hang" = "load";
  static response = JSON.stringify({ status: "ok", data: { transport: "xhr" } });
  status = 200;
  timeout = 0;
  responseText = TestXHR.response;
  headers: Record<string, string> = {};
  body: unknown;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open = vi.fn();
  constructor() { TestXHR.instances.push(this); }
  setRequestHeader(key: string, value: string) { this.headers[key] = value; }
  abort = vi.fn(() => this.onabort?.());
  send(body: unknown) {
    this.body = body;
    queueMicrotask(() => {
      if (TestXHR.event === "load") this.onload?.();
      if (TestXHR.event === "error") this.onerror?.();
      if (TestXHR.event === "timeout") this.ontimeout?.();
    });
  }
}

const options = { baseUrl: "https://example.test", namespace: "catalog", functionName: "upload" };
const ok = () => Response.json({ status: "ok", data: { transport: "fetch" }, meta: {} });
const webData = () => ({ file: new File([new Uint8Array([0, 255, 13, 10, 128])], "binary.bin", { type: "application/octet-stream" }) });
const nativeData = () => ({ file: { uri: " file:///tmp/photo.png ", fileName: "photo.png", mimeType: "image/png" } });

function browserGlobals() { vi.stubGlobal("XMLHttpRequest", TestXHR); }
function nativeGlobals() { browserGlobals(); vi.stubGlobal("FormData", NativeFormData); }

function hangingFetch() {
  return vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  TestXHR.instances = [];
  TestXHR.event = "load";
  TestXHR.response = JSON.stringify({ status: "ok", data: { transport: "xhr" } });
});

describe("browser multipart transport", () => {
  it.each(["ordinary browser", "missing navigator", "ReactNative product", "Hermes global"])("honors fetchFn with web FormData: %s", async marker => {
    browserGlobals();
    if (marker === "missing navigator") vi.stubGlobal("navigator", undefined);
    if (marker === "ReactNative product") vi.stubGlobal("navigator", { product: "ReactNative" });
    if (marker === "Hermes global") vi.stubGlobal("HermesInternal", {});
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    const result = await rawRpcRequest({ ...options, data: webData(), fetchFn });
    expect(result).toEqual({ transport: "fetch" });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(TestXHR.instances).toHaveLength(0);
  });

  it("uses the default web fetch even when XHR exists", async () => {
    browserGlobals();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    vi.stubGlobal("fetch", fetchFn);
    await rawRpcRequest({ ...options, data: webData() });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(TestXHR.instances).toHaveLength(0);
  });

  it("uses fetchFn for forced multipart text and treats a non-callable getParts as web data", async () => {
    browserGlobals();
    class WebFormData extends FormData { getParts = "not a native bridge method"; }
    vi.stubGlobal("FormData", WebFormData);
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    await rawRpcRequest({ ...options, multipart: true, data: { title: "text" }, fetchFn });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(TestXHR.instances).toHaveLength(0);
  });

  it("preserves real File/Blob bytes, empty files, arrays, metadata and body routing", async () => {
    browserGlobals();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    const original = webData().file;
    const empty = new File([], "empty.bin", { type: "application/octet-stream" });
    const client = createRpcClient({ ...options, defaultBody: { tenant: "default" }, defaultHeaders: { authorization: "Bearer test", "Content-Type": "application/json", "content-type": "incorrect" }, fetchFn });
    await client.request({ namespace: options.namespace, functionName: options.functionName, data: { files: [original, empty], blob: new Blob(["hello"], { type: "text/plain" }), title: "upload", namespace: "data-only" } });
    expect(fetchFn).toHaveBeenCalledOnce();
    const init = fetchFn.mock.calls[0][1];
    expect(init?.body).toBeInstanceOf(FormData);
    if (!(init?.body instanceof FormData)) throw new Error("Expected native web FormData");
    const form = init.body;
    expect(form.get("namespace")).toBe("catalog");
    expect(form.get("functionName")).toBe("upload");
    expect(form.get("_data_namespace")).toBe("data-only");
    expect(form.get("tenant")).toBe("default");
    const files = form.getAll("files");
    expect(files).toHaveLength(2);
    if (!(files[0] instanceof File) || !(files[1] instanceof File)) throw new Error("Expected files");
    expect(files[0].name).toBe("binary.bin");
    expect(files[0].type).toBe("application/octet-stream");
    expect(new Uint8Array(await files[0].arrayBuffer())).toEqual(new Uint8Array([0, 255, 13, 10, 128]));
    expect(files[1].name).toBe("empty.bin");
    expect(files[1].size).toBe(0);
    const blob = form.get("blob");
    if (!(blob instanceof Blob)) throw new Error("Expected Blob");
    expect(await blob.text()).toBe("hello");
    expect(init?.headers).toMatchObject({ authorization: "Bearer test", "X-CRPC-Namespace": "catalog", "X-CRPC-Function": "upload" });
    expect(Object.keys(init.headers ?? {}).some(key => key.toLowerCase() === "content-type")).toBe(false);
  });

  it("allows fetchFn to set credentials and intercept multipart headers", async () => {
    browserGlobals();
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    const fetchFn: typeof fetch = (url, init) => transport(url, { ...init, credentials: "include", headers: { ...init?.headers, "x-interceptor": "active" } });
    await rawRpcRequest({ ...options, data: webData(), fetchFn });
    expect(transport).toHaveBeenCalledWith("https://example.test/rpc", expect.objectContaining({ credentials: "include", headers: expect.objectContaining({ "x-interceptor": "active" }) }));
  });

  it.each(["top-level object", "array of objects"])("rejects nested files before either transport: %s", async structure => {
    browserGlobals();
    const fetchFn = vi.fn<typeof fetch>();
    const data = structure === "top-level object" ? { nested: webData() } : { nested: [webData()] };
    await expect(rawRpcRequest({ ...options, data, fetchFn })).rejects.toThrow(/Unsupported nested file structure/);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(TestXHR.instances).toHaveLength(0);
  });

  it("preserves application error details and meta through fetchFn", async () => {
    browserGlobals();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ status: "error", code: "forbidden", message: "Denied", details: { role: "reader" }, meta: { requestId: "test" } }));
    await expect(rawRpcRequest({ ...options, data: webData(), fetchFn })).rejects.toMatchObject({ code: "forbidden", message: "Denied", status: 200, details: { role: "reader" }, meta: { requestId: "test" } });
  });

  it.each(["parse", "network"])("preserves fetch %s errors", async failure => {
    browserGlobals();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => {
      if (failure === "network") throw new TypeError("offline");
      return new Response("not JSON", { status: 502 });
    });
    await expect(rawRpcRequest({ ...options, data: webData(), fetchFn })).rejects.toMatchObject({ code: failure === "parse" ? "parse_error" : "network_error" });
  });

  it.each(["abort", "timeout"])("preserves fetch %s and clears request timers/listeners", async ending => {
    browserGlobals();
    vi.useFakeTimers();
    const user = new AbortController();
    const remove = vi.spyOn(user.signal, "removeEventListener");
    const fetchFn = hangingFetch();
    const outcome = rawRpcRequest({ ...options, data: webData(), fetchFn, signal: user.signal, timeoutMs: 50 }).catch(error => error);
    if (ending === "abort") user.abort(); else await vi.advanceTimersByTimeAsync(50);
    expect(await outcome).toMatchObject({ code: ending === "abort" ? "aborted" : "timeout" });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("rejects a pre-aborted browser upload without choosing a transport", async () => {
    browserGlobals();
    const user = new AbortController(); user.abort();
    const fetchFn = vi.fn<typeof fetch>();
    await expect(rawRpcRequest({ ...options, data: webData(), fetchFn, signal: user.signal })).rejects.toMatchObject({ code: "aborted" });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(TestXHR.instances).toHaveLength(0);
  });
});

describe("React Native bridge FormData", () => {
  it.each(["no runtime markers", "browser navigator", "Hermes"])("retains XHR without depending on global markers: %s", async marker => {
    nativeGlobals();
    vi.stubGlobal("navigator", marker === "browser navigator" ? { product: "Gecko" } : undefined);
    if (marker === "Hermes") vi.stubGlobal("HermesInternal", {});
    const fetchFn = vi.fn<typeof fetch>();
    await expect(rawRpcRequest({ ...options, data: { files: [nativeData().file, { uri: "content://photo/2" }] }, fetchFn })).resolves.toEqual({ transport: "xhr" });
    expect(fetchFn).not.toHaveBeenCalled();
    const xhr = TestXHR.instances[0];
    if (!(xhr.body instanceof NativeFormData)) throw new Error("Expected native bridge body");
    expect(xhr.body.getAll("files")).toEqual([{ uri: "file:///tmp/photo.png", name: "photo.png", type: "image/png" }, { uri: "content://photo/2", name: "upload.jpg", type: "image/jpeg" }]);
    expect(xhr.headers).toMatchObject({ "X-CRPC-Namespace": "catalog", "X-CRPC-Function": "upload" });
    expect(Object.keys(xhr.headers).some(key => key.toLowerCase() === "content-type")).toBe(false);
  });

  it("retains XHR for native forced text multipart", async () => {
    nativeGlobals();
    const fetchFn = vi.fn<typeof fetch>();
    await rawRpcRequest({ ...options, data: { title: "text" }, multipart: true, fetchFn });
    expect(TestXHR.instances).toHaveLength(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("keeps JSON on fetchFn even with native FormData and XHR installed", async () => {
    nativeGlobals();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    await rawRpcRequest({ ...options, data: { title: "json" }, fetchFn });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(TestXHR.instances).toHaveLength(0);
  });

  it("retains the fetchFn fallback when native XHR is absent", async () => {
    nativeGlobals(); vi.stubGlobal("XMLHttpRequest", undefined);
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    await rawRpcRequest({ ...options, data: nativeData(), fetchFn });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it.each(["load", "error", "timeout", "application", "parse", "abort"])("preserves native XHR %s behavior and abort-listener cleanup", async ending => {
    nativeGlobals(); vi.useFakeTimers();
    TestXHR.event = ending === "abort" ? "hang" : ending === "error" || ending === "timeout" ? ending : "load";
    if (ending === "application") TestXHR.response = JSON.stringify({ status: "error", code: "forbidden", message: "Denied", details: { role: "reader" }, meta: { requestId: "native" } });
    if (ending === "parse") TestXHR.response = "not JSON";
    const remove = vi.spyOn(AbortSignal.prototype, "removeEventListener");
    const user = new AbortController();
    const outcome = rawRpcRequest({ ...options, data: nativeData(), signal: user.signal, timeoutMs: 500 }).catch(error => error);
    if (ending === "abort") user.abort();
    const result = await outcome;
    if (ending === "load") expect(result).toEqual({ transport: "xhr" });
    else expect(result).toMatchObject({ code: ({ error: "network_error", timeout: "timeout", application: "forbidden", parse: "parse_error", abort: "aborted" })[ending] });
    if (ending === "application") expect(result).toMatchObject({ details: { role: "reader" }, meta: { requestId: "native" } });
    expect(remove).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
