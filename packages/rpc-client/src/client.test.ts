import { describe, it, expect, vi } from "vitest";
import { rawRpcRequest, createRpcClient } from "./client";
import { RpcError } from "./errors";

describe("rpc-client core", () => {
  it("executes JSON rpc request successfully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        status: "ok",
        data: { message: "hello world" },
        meta: { durationMs: 1.2 },
      }),
    });

    const data = await rawRpcRequest<{ message: string }>({
      baseUrl: "http://localhost:4000/rpc",
      namespace: "public",
      functionName: "hello",
      data: { name: "Minhaz" },
      fetchFn: mockFetch as any,
    });

    expect(data.message).toBe("hello world");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4000/rpc",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("handles multipart form-data requests cleanly", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        status: "ok",
        data: { uploaded: true },
        meta: {},
      }),
    });

    const data = await rawRpcRequest<{ uploaded: boolean }>({
      baseUrl: "http://localhost:4000/rpc",
      namespace: "public",
      functionName: "upload",
      multipart: true,
      data: { title: "Test Document", age: 25 },
      fetchFn: mockFetch as any,
    });

    expect(data.uploaded).toBe(true);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("http://localhost:4000/rpc");
    expect(callArgs[1].body).toBeInstanceOf(FormData);
  });

  it("automatically detects file objects in data and uses multipart form-data without explicit multipart flag", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        status: "ok",
        data: { autoDetected: true },
        meta: {},
      }),
    });

    const data = await rawRpcRequest<{ autoDetected: boolean }>({
      baseUrl: "http://localhost:4000/rpc",
      namespace: "admin",
      functionName: "createBrand",
      // Notice: multipart is NOT passed (defaults to false)
      data: {
        name: "Test Brand",
        logo: {
          uri: "file:///path/to/logo.png",
          name: "logo.png",
          type: "image/png",
        },
      },
      fetchFn: mockFetch as any,
    });

    expect(data.autoDetected).toBe(true);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("http://localhost:4000/rpc");
    expect(callArgs[1].body).toBeInstanceOf(FormData);
    const formData = callArgs[1].body as FormData;
    expect(formData.get("namespace")).toBe("admin");
    expect(formData.get("functionName")).toBe("createBrand");
    expect(formData.get("name")).toBe("Test Brand");
  });


  it("throws RpcError when server returns error payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        status: "error",
        code: "unauthorized",
        message: "Invalid token",
      }),
    });

    await expect(
      rawRpcRequest({
        baseUrl: "http://localhost:4000/rpc",
        namespace: "auth",
        functionName: "profile",
        fetchFn: mockFetch as any,
      }),
    ).rejects.toThrow(RpcError);
  });

  it("createRpcClient resolves dynamic defaultHeaders", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        status: "ok",
        data: { success: true },
        meta: {},
      }),
    });

    const client = createRpcClient({
      baseUrl: "http://localhost:4000/rpc",
      defaultHeaders: () => ({
        authorization: "Bearer dynamic_token_123",
        "x-tenant-id": "tenant_abc",
      }),
      fetchFn: mockFetch as any,
    });

    const res = await client.request<{ success: boolean }>({
      namespace: "admin",
      functionName: "list",
    });

    expect(res.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4000/rpc",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer dynamic_token_123",
          "x-tenant-id": "tenant_abc",
        }),
      }),
    );
  });

  it("merges defaultBody with request data and auto-detects multipart payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        status: "ok",
        data: { created: true },
        meta: {},
      }),
    });

    const client = createRpcClient({
      baseUrl: "http://localhost:4000/rpc",
      defaultBody: { appId: "com.iqbal.autoparts" },
      fetchFn: mockFetch as any,
    });

    const res = await client.request<{ created: boolean }>({
      namespace: "catalog",
      functionName: "uploadPart",
      data: {
        partName: "Brake Pad",
        file: {
          uri: "file:///tmp/part.png",
          name: "part.png",
          type: "image/png",
        },
      },
    });

    expect(res.created).toBe(true);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].body).toBeInstanceOf(FormData);
    const formData = callArgs[1].body as FormData;
    expect(formData.get("appId")).toBe("com.iqbal.autoparts");
    expect(formData.get("partName")).toBe("Brake Pad");
  });

  it("throws clear configuration error when baseUrl is missing", async () => {
    // Missing baseUrl
    await expect(
      rawRpcRequest({
        baseUrl: "",
        namespace: "test",
        functionName: "test",
      }),
    ).rejects.toThrow("baseUrl\" is required");
  });
});

