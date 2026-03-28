import type { RedisClient } from "../types/redis-types";

export const xaddToStream = async (
  connection: RedisClient,
  streamKey: string,
  fields: Array<string>,
  maxStreamLength?: number | null,
): Promise<string> => {
  const args: Array<string | number> = [streamKey];
  if (maxStreamLength) {
    args.push("MAXLEN", "~", maxStreamLength);
  }
  args.push("*", ...fields);
  return connection.xadd(...args);
};
