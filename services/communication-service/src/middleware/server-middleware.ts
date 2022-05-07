import { cacheMiddleware, redisMiddleware } from "@lindorm-io/koa-redis";
import { configuration } from "../configuration";
import { redisConnection } from "../instance";
import { tokenIssuerMiddleware } from "@lindorm-io/koa-jwt";
import { KeyPairCache, cacheKeysMiddleware, keystoreMiddleware } from "@lindorm-io/koa-keystore";

export const serverMiddlewares = [
  // Cache

  redisMiddleware(redisConnection),
  cacheMiddleware(KeyPairCache),

  // JWT

  cacheKeysMiddleware,
  keystoreMiddleware,
  tokenIssuerMiddleware({
    issuer: configuration.server.host,
  }),
];
