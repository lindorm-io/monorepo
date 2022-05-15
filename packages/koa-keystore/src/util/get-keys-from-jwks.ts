import { DefaultLindormKeystoreContext, JwksKeysMiddlewareConfig } from "../types";
import { KeyPair } from "@lindorm-io/key-pair";
import { flatten } from "lodash";
import { WebKeyHandler } from "../class";

export const getKeysFromJwks = async (
  ctx: DefaultLindormKeystoreContext,
  config: JwksKeysMiddlewareConfig,
): Promise<Array<KeyPair>> => {
  const handler = new WebKeyHandler({
    clientName: config.clientName,
    host: config.host,
    port: config.port,
    logger: ctx.logger,
  });

  const found = await handler.getKeys();
  const keys = flatten([ctx.keys, found]);

  ctx.logger.debug("keys found on client", {
    clientName: config.clientName,
    current: ctx.keys.length,
    found: found.length,
    host: config.host,
    port: config.port,
    total: keys.length,
  });

  return keys;
};
