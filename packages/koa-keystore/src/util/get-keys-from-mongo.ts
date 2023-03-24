import { DefaultLindormKeystoreContext } from "../types";
import { KeyPair } from "@lindorm-io/key-pair";

export const getKeysFromMongo = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<KeyPair>> => {
  const found = await ctx.mongo.keyPairMongoRepository.findMany({});
  const keys = [ctx.keys, found].flat();

  ctx.logger.debug("Keys found in mongo repository", {
    current: ctx.keys.length,
    found: found.length,
    total: keys.length,
  });

  return keys;
};
