import { DefaultLindormKeystoreContext } from "../types";
import { KeyPair } from "@lindorm-io/key-pair";

export const getKeysFromMemory = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<KeyPair>> => {
  const found = await ctx.memory.keyPairMemoryCache.findMany({});
  const keys = [ctx.keys, found].flat();

  ctx.logger.debug("Keys found in memory cache", {
    current: ctx.keys.length,
    found: found.length,
    total: keys.length,
  });

  return keys;
};
