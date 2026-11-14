import { createItem, type ItemRecord } from "../../../store";

export const run = async (
  input: { title: string; category: string; price: number; tags: string[] },
  _context?: any,
): Promise<ItemRecord> => {
  return createItem(input);
};

export default run;
