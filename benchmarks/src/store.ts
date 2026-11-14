export interface ItemRecord {
  id: string;
  title: string;
  category: string;
  price: number;
  tags: string[];
  createdAt: string;
}

export const store = new Map<string, ItemRecord>();
let itemSeq = 100;

// Pre-seed 100 items
for (let i = 1; i <= 100; i++) {
  const id = `item_${i}`;
  store.set(id, {
    id,
    title: `Benchmark Item #${i}`,
    category: "cloud_compute",
    price: 49.99 + i,
    tags: ["rpc", "benchmark", "node"],
    createdAt: new Date().toISOString(),
  });
}

export function createItem(data: Omit<ItemRecord, "id" | "createdAt">): ItemRecord {
  itemSeq++;
  const id = `item_${itemSeq}`;
  const record: ItemRecord = {
    id,
    ...data,
    createdAt: new Date().toISOString(),
  };
  store.set(id, record);
  return record;
}
