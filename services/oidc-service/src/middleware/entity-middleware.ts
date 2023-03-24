import { OidcSession } from "../entity";
import { OidcSessionCache } from "../infrastructure";
import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";

export const oidcSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  OidcSession,
  OidcSessionCache,
);
