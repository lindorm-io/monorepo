import { DefaultLindormKeystoreContext, JwksKeysMiddlewareConfig } from "../types";
import { KeyPair } from "@lindorm-io/key-pair";
import { flatten } from "lodash";
import { WebKeyHandler } from "../class";

export const getKeysFromJwks = async (
  ctx: DefaultLindormKeystoreContext,
  config: JwksKeysMiddlewareConfig,
): Promise<Array<KeyPair>> => {
  const handler = new WebKeyHandler({
    host: config.host,
    logger: ctx.logger,
    name: config.name,
    port: config.port,
  });

  const found = await handler.getKeys();
  const keys = flatten([ctx.keys, found]);

  ctx.logger.debug("keys found on client", {
    clientName: config.name,
    current: ctx.keys.length,
    found: found.length,
    host: config.host,
    port: config.port,
    total: keys.length,
  });

  return keys;
};
