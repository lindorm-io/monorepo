import { DefaultLindormKeystoreContext } from "../types";
import { KeyPair } from "@lindorm-io/key-pair";

export const getKeysFromRepository = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<KeyPair>> => {
  const found = await ctx.repository.keyPairRepository.findMany({});
  const keys = [ctx.keys, found].flat();

  ctx.logger.debug("keys found in repository", {
    current: ctx.keys.length,
    found: found.length,
    total: keys.length,
  });

  return keys;
};
