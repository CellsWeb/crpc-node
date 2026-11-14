import { listItems, type ItemRecord } from "../../../store";

export const run = async (
  input: { limit?: number },
  _context?: any,
): Promise<{ items: ItemRecord[]; total: number }> => {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  return listItems(limit);
};

export default run;
