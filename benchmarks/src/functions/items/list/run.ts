import { store, type ItemRecord } from "../../../store";

export const run = async (
  input: { limit?: number },
  _context?: any,
): Promise<{ items: ItemRecord[]; total: number }> => {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const items: ItemRecord[] = [];

  for (const item of store.values()) {
    items.push(item);
    if (items.length >= limit) break;
  }

  return {
    items,
    total: store.size,
  };
};

export default run;
