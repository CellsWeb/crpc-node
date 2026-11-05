import fs from "node:fs";
import fsPromises from "node:fs/promises";
import type { Readable } from "node:stream";

export interface UploadedFileOptions {
  readonly path: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly byteLength: number;
}

export class UploadedFile {
  public readonly path: string;
  public readonly filename: string;
  public readonly mimeType: string;
  public readonly byteLength: number;

  constructor(opts: UploadedFileOptions) {
    this.path = opts.path;
    this.filename = opts.filename;
    this.mimeType = opts.mimeType;
    this.byteLength = opts.byteLength;
  }

  public createReadStream(): Readable {
    return fs.createReadStream(this.path);
  }

  public async toBuffer(): Promise<Buffer> {
    return fsPromises.readFile(this.path);
  }

  public async toBlob(): Promise<Blob> {
    const buffer = await this.toBuffer();
    return new Blob([new Uint8Array(buffer)], { type: this.mimeType });
  }
}

export function createUploadedFile(opts: UploadedFileOptions): UploadedFile {
  return new UploadedFile(opts);
}
