import { DefaultLindormKeystoreContext } from "../types";
import { KeyPair } from "@lindorm-io/key-pair";

export const getKeysFromCache = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<KeyPair>> => {
  const found = await ctx.cache.keyPairCache.findMany({});
  const keys = [ctx.keys, found].flat();

  ctx.logger.debug("keys found in cache", {
    current: ctx.keys.length,
    found: found.length,
    total: keys.length,
  });

  return keys;
};
