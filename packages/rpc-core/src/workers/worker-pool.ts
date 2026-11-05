import { Worker } from "node:worker_threads";
import os from "node:os";
import { createId } from "@paralleldrive/cuid2";
import { AppError, ErrorCode } from "../errors";

export type WorkerTransferList = Parameters<Worker["postMessage"]>[1];

export interface WorkerTask {
  id: string;
  filePath: string;
  input: unknown;
  context: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  transferList?: WorkerTransferList;
}

const WORKER_SCRIPT = `
const { parentPort } = require("node:worker_threads");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");

const moduleCache = new Map();

function rehydrateFiles(val) {
  if (!val || typeof val !== "object") return val;
  if (val instanceof Date || val instanceof RegExp) return val;
  if (Buffer.isBuffer(val) || ArrayBuffer.isView(val)) return val;
  if (Array.isArray(val)) return val.map(rehydrateFiles);
  if (typeof val.path === "string" && typeof val.filename === "string" && typeof val.byteLength === "number") {
    return {
      ...val,
      createReadStream: () => fs.createReadStream(val.path),
      toBuffer: () => fsPromises.readFile(val.path),
      toBlob: async () => {
        const buf = await fsPromises.readFile(val.path);
        return new Blob([new Uint8Array(buf)], { type: val.mimeType });
      },
    };
  }
  const clean = {};
  for (const [k, v] of Object.entries(val)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    clean[k] = rehydrateFiles(v);
  }
  return clean;
}

async function getModule(filePath) {
  let mod = moduleCache.get(filePath);
  if (!mod) {
    const href = pathToFileURL(filePath).href;
    mod = await import(href);
    moduleCache.set(filePath, mod);
  }
  return mod;
}

parentPort.on("message", async (task) => {
  try {
    const mod = await getModule(task.filePath);
    const runFn = mod.run ?? mod.default?.run ?? mod.default;
    if (typeof runFn !== "function") {
      throw new Error("Function at " + task.filePath + " does not export a run function");
    }
    const input = rehydrateFiles(task.input);
    const result = await runFn(input, task.context);
    parentPort.postMessage({ id: task.id, status: "ok", result });
  } catch (err) {
    const isObj = err !== null && typeof err === "object";
    const message = isObj && "message" in err ? String(err.message) : String(err);
    const code = isObj && "code" in err ? err.code : "internal_error";
    const details = isObj && "details" in err ? err.details : undefined;
    const stack = isObj && "stack" in err ? err.stack : undefined;

    parentPort.postMessage({
      id: task.id,
      status: "error",
      message,
      code,
      details,
      stack,
    });
  }
});
`;

export class WorkerPool {
  private workers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks = new Map<Worker, WorkerTask>();
  private size: number;
  private isTerminated = false;

  constructor(size?: number) {
    const cpus = os.cpus().length || 4;
    this.size = size ?? Math.max(2, Math.min(cpus - 1, 8));
  }

  private initWorker(): Worker {
    const worker = new Worker(WORKER_SCRIPT, {
      eval: true,
      execArgv: process.execArgv,
    });

    worker.on("message", (msg: {
      id: string;
      status: "ok" | "error";
      result?: unknown;
      message?: string;
      code?: string;
      details?: unknown;
    }) => {
      const activeTask = this.activeTasks.get(worker);
      if (activeTask && activeTask.id === msg.id) {
        this.activeTasks.delete(worker);
        if (msg.status === "ok") {
          activeTask.resolve(msg.result);
        } else {
          activeTask.reject(
            new AppError(
              (msg.code as ErrorCode) || ErrorCode.INTERNAL_ERROR,
              msg.message ?? "Worker execution failed",
              msg.details,
            ),
          );
        }
      }

      if (!this.isTerminated) {
        this.idleWorkers.push(worker);
        this.dispatchNext();
      }
    });

    worker.on("error", (err: Error) => {
      const activeTask = this.activeTasks.get(worker);
      if (activeTask) {
        this.activeTasks.delete(worker);
        activeTask.reject(
          new AppError(
            ErrorCode.INTERNAL_ERROR,
            `Worker error during execution: ${err?.message ?? String(err)}`,
          ),
        );
      }
      this.removeAndReplaceWorker(worker);
    });

    worker.on("exit", (code) => {
      const activeTask = this.activeTasks.get(worker);
      if (activeTask) {
        this.activeTasks.delete(worker);
        activeTask.reject(
          new AppError(
            ErrorCode.INTERNAL_ERROR,
            `Worker thread exited unexpectedly with code ${code}`,
          ),
        );
      }
      if (!this.isTerminated) {
        this.removeAndReplaceWorker(worker);
      }
    });

    return worker;
  }

  private removeAndReplaceWorker(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }
    const idleIndex = this.idleWorkers.indexOf(worker);
    if (idleIndex !== -1) {
      this.idleWorkers.splice(idleIndex, 1);
    }
    this.activeTasks.delete(worker);

    if (!this.isTerminated) {
      const newWorker = this.initWorker();
      this.workers.push(newWorker);
      this.idleWorkers.push(newWorker);
      this.dispatchNext();
    }
  }

  private ensureWorkers(): void {
    while (this.workers.length < this.size) {
      const worker = this.initWorker();
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }

  private dispatchNext(): void {
    if (this.isTerminated || this.taskQueue.length === 0 || this.idleWorkers.length === 0) {
      return;
    }

    const task = this.taskQueue.shift()!;
    const worker = this.idleWorkers.shift()!;
    this.activeTasks.set(worker, task);

    const payload = {
      id: task.id,
      filePath: task.filePath,
      input: task.input,
      context: task.context,
    };

    try {
      if (task.transferList && task.transferList.length > 0) {
        worker.postMessage(payload, task.transferList);
      } else {
        worker.postMessage(payload);
      }
    } catch (err) {
      this.activeTasks.delete(worker);
      this.idleWorkers.push(worker);
      task.reject(
        new AppError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to post message to worker: ${(err as Error)?.message ?? String(err)}`,
        ),
      );
      this.dispatchNext();
    }
  }

  public async run<T = unknown>(
    filePath: string,
    input: unknown,
    context: Record<string, unknown>,
    transferList?: WorkerTransferList,
  ): Promise<T> {
    if (this.isTerminated) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Worker pool has been terminated");
    }

    this.ensureWorkers();

    return new Promise<T>((resolve, reject) => {
      const task: WorkerTask = {
        id: createId(),
        filePath,
        input,
        context,
        resolve: resolve as (val: unknown) => void,
        reject,
        transferList,
      };

      this.taskQueue.push(task);
      this.dispatchNext();
    });
  }

  public async terminate(): Promise<void> {
    this.isTerminated = true;
    for (const task of this.taskQueue) {
      task.reject(new AppError(ErrorCode.INTERNAL_ERROR, "Worker pool terminated before task could run"));
    }
    this.taskQueue = [];

    for (const [worker, task] of this.activeTasks.entries()) {
      task.reject(new AppError(ErrorCode.INTERNAL_ERROR, "Worker pool terminated during task execution"));
    }
    this.activeTasks.clear();

    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.idleWorkers = [];
  }
}

let globalWorkerPool: WorkerPool | null = null;

export function getGlobalWorkerPool(): WorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new WorkerPool();
  }
  return globalWorkerPool;
}

export async function shutdownGlobalWorkerPool(): Promise<void> {
  if (globalWorkerPool) {
    await globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}
