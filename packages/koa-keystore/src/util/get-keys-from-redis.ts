import { DefaultLindormKeystoreContext } from "../types";
import { KeyPair } from "@lindorm-io/key-pair";

export const getKeysFromRedis = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<KeyPair>> => {
  const found = await ctx.redis.keyPairRedisRepository.findMany({});
  const keys = [ctx.keys, found].flat();

  ctx.logger.debug("Keys found in redis cache", {
    current: ctx.keys.length,
    found: found.length,
    total: keys.length,
  });

  return keys;
};
