import { AppError, ErrorCode } from "@cellsweb/rpc-core";
import { getItem, type ItemRecord } from "../../../store";

export const run = async (input: { id: string }, _context?: any): Promise<ItemRecord> => {
  const item = await getItem(input.id);
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, `Item "${input.id}" not found`);
  }
  return item;
};

export default run;
