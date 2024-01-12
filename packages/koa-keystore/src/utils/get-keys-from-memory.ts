import { WebKeySet } from "@lindorm-io/jwk";
import { DefaultLindormKeystoreContext } from "../types";

export const getKeysFromMemory = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<WebKeySet>> => {
  const keys = await ctx.memory.storedKeySetMemoryCache.findMany({});

  ctx.logger.debug("Keys found in memory cache", {
    amount: keys.length,
  });

  return keys.map((key) => key.webKeySet);
};
