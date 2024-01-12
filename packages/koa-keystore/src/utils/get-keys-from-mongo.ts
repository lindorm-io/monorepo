import { WebKeySet } from "@lindorm-io/jwk";
import { DefaultLindormKeystoreContext } from "../types";

export const getKeysFromMongo = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<WebKeySet>> => {
  const keys = await ctx.mongo.storedKeySetMongoRepository.findMany({});

  ctx.logger.debug("Keys found in mongo repository", {
    amount: keys.length,
  });

  return keys.map((key) => key.webKeySet);
};
