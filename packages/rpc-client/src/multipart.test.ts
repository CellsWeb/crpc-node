import { describe, it, expect } from "vitest";
import {
  isBlobOrFile,
  isReactNativeFile,
  hasMultipartData,
  buildRpcFormData,
} from "./multipart";

describe("multipart utilities", () => {
  it("isBlobOrFile correctly identifies Blob/File objects", () => {
    expect(isBlobOrFile(null)).toBe(false);
    expect(isBlobOrFile(undefined)).toBe(false);
    expect(isBlobOrFile({ uri: "file://test" })).toBe(false);
    expect(isBlobOrFile("string")).toBe(false);

    if (typeof Blob !== "undefined") {
      const blob = new Blob(["test"], { type: "text/plain" });
      expect(isBlobOrFile(blob)).toBe(true);
    }
  });

  it("isReactNativeFile correctly identifies RN file objects", () => {
    const rnFileWithAll = {
      uri: "file:///path/to/img.png",
      name: "img.png",
      type: "image/png",
    };
    const rnFileWithUriName = {
      uri: "file:///path/to/img.png",
      name: "img.png",
    };
    const rnFileWithUriType = {
      uri: "file:///path/to/img.png",
      type: "image/png",
    };
    const invalidNoUri = {
      name: "img.png",
      type: "image/png",
    };
    const rnFileWithUriOnly = {
      uri: "file:///path/to/img.png",
    };

    expect(isReactNativeFile(rnFileWithAll)).toBe(true);
    expect(isReactNativeFile(rnFileWithUriName)).toBe(true);
    expect(isReactNativeFile(rnFileWithUriType)).toBe(true);
    expect(isReactNativeFile(rnFileWithUriOnly)).toBe(true);
    expect(isReactNativeFile(invalidNoUri)).toBe(false);
    expect(isReactNativeFile(null)).toBe(false);
    expect(isReactNativeFile([rnFileWithAll])).toBe(false);
  });

  it("hasMultipartData auto-detects files in flat or nested objects/arrays", () => {
    const jsonPayload = {
      name: "Iqbal Parts",
      sku: "PART-12345",
      price: 150.5,
      active: true,
    };
    expect(hasMultipartData(jsonPayload)).toBe(false);

    const flatFilePayload = {
      name: "Brand Logo",
      logo: {
        uri: "ph://1234-5678",
        name: "logo.png",
        type: "image/png",
      },
    };
    expect(hasMultipartData(flatFilePayload)).toBe(true);

    const nestedFilePayload = {
      item: {
        name: "Sub Component",
        attachment: {
          uri: "file:///tmp/doc.pdf",
          name: "doc.pdf",
          type: "application/pdf",
        },
      },
    };
    expect(hasMultipartData(nestedFilePayload)).toBe(true);

    const arrayFilePayload = {
      title: "Gallery",
      images: [
        "https://example.com/existing.jpg",
        {
          uri: "file:///tmp/new.jpg",
          name: "new.jpg",
          type: "image/jpeg",
        },
      ],
    };
    expect(hasMultipartData(arrayFilePayload)).toBe(true);
  });

  it("buildRpcFormData appends namespace, functionName, fields, and Web Blob/File or RN file objects", () => {
    const rnFile = {
      uri: "file:///tmp/test.png",
      name: "test.png",
      type: "image/png",
    };

    const formData = buildRpcFormData("catalog", "createBrand", {
      name: "Test Brand",
      image: rnFile,
    });

    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("namespace")).toBe("catalog");
    expect(formData.get("functionName")).toBe("createBrand");
    expect(formData.get("name")).toBe("Test Brand");
    expect(formData.has("image")).toBe(true);

    if (typeof Blob !== "undefined") {
      const blob = new Blob(["hello"], { type: "text/plain" });
      const blobFormData = buildRpcFormData("docs", "upload", { file: blob });
      expect(blobFormData.get("file")).toBeInstanceOf(Blob);
    }
  });
});
