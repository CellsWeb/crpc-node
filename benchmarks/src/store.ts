import fs from "node:fs";
import path from "node:path";
import pg from "pg";

export interface ItemRecord {
  id: string;
  title: string;
  category: string;
  price: number;
  tags: string[];
  createdAt: string;
}

export interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  savedPath: string;
  createdAt: string;
}

export const store = new Map<string, ItemRecord>();
export const uploadStore = new Map<string, UploadRecord>();
let itemSeq = 1000;
let uploadSeq = 0;

// PostgreSQL Connection Pool (Optional, active when DATABASE_URL is set)
const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/benchdb";
export const pgPool = new pg.Pool({
  connectionString: dbUrl,
  max: 50,
  idleTimeoutMillis: 30000,
});

let dbConnected = false;
pgPool.query("SELECT 1")
  .then(() => {
    dbConnected = true;
    console.log("📦 Connected to PostgreSQL for real database benchmarks");
  })
  .catch((err) => {
    console.log("ℹ️  PostgreSQL not connected, falling back to in-memory store:", err.message);
  });

export function isDbConnected(): boolean {
  return dbConnected;
}

// Pre-seed 100 items in memory
for (let i = 1; i <= 100; i++) {
  const id = `item_${i}`;
  store.set(id, {
    id,
    title: `Benchmark Item #${i}`,
    category: i % 3 === 0 ? "electronics" : i % 3 === 1 ? "apparel" : "home",
    price: 49.99 + i,
    tags: ["rpc", "benchmark", "node"],
    createdAt: new Date().toISOString(),
  });
}

export async function createItem(data: Omit<ItemRecord, "id" | "createdAt">): Promise<ItemRecord> {
  itemSeq++;
  const id = `item_${itemSeq}`;
  const record: ItemRecord = {
    id,
    ...data,
    createdAt: new Date().toISOString(),
  };

  if (dbConnected) {
    try {
      await pgPool.query(
        "INSERT INTO items (id, title, price, category, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING",
        [id, data.title, data.price, data.category]
      );
    } catch {
      // ignore conflict in benchmarks
    }
  }

  store.set(id, record);
  return record;
}

export async function getItem(id: string): Promise<ItemRecord | null> {
  if (dbConnected) {
    try {
      const res = await pgPool.query("SELECT id, title, price, category, created_at FROM items WHERE id = $1 LIMIT 1", [id]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          title: row.title,
          price: Number(row.price),
          category: row.category,
          tags: ["postgres", "rpc"],
          createdAt: row.created_at.toISOString(),
        };
      }
    } catch {
      // fallback
    }
  }

  return store.get(id) || null;
}

export async function listItems(limit: number): Promise<{ items: ItemRecord[]; total: number }> {
  if (dbConnected) {
    try {
      const res = await pgPool.query("SELECT id, title, price, category, created_at FROM items ORDER BY created_at DESC LIMIT $1", [limit]);
      const items: ItemRecord[] = res.rows.map(row => ({
        id: row.id,
        title: row.title,
        price: Number(row.price),
        category: row.category,
        tags: ["postgres", "rpc"],
        createdAt: row.created_at.toISOString(),
      }));
      return { items, total: items.length };
    } catch {
      // fallback
    }
  }

  const items = Array.from(store.values()).slice(0, limit);
  return { items, total: store.size };
}

export async function saveUpload(opts: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ id: string; savedPath: string; dbSaved: boolean }> {
  uploadSeq++;
  const id = `upl_${Date.now()}_${uploadSeq}`;
  const uploadDir = path.resolve(process.cwd(), "bench-uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const savedPath = path.join(uploadDir, `${id}_${path.basename(opts.fileName)}`);
  await fs.promises.writeFile(savedPath, opts.buffer);

  let dbSaved = false;
  if (dbConnected) {
    try {
      await pgPool.query(
        "INSERT INTO uploads (id, file_name, file_size, mime_type, file_path, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
        [id, opts.fileName, opts.fileSize, opts.mimeType, savedPath]
      );
      dbSaved = true;
    } catch {
      // fallback
    }
  }

  uploadStore.set(id, {
    id,
    fileName: opts.fileName,
    fileSize: opts.fileSize,
    mimeType: opts.mimeType,
    savedPath,
    createdAt: new Date().toISOString(),
  });

  return { id, savedPath, dbSaved };
}
