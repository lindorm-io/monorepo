import { OidcSession } from "../entity";
import { OidcSessionCache } from "../infrastructure";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";

export const oidcSessionEntityMiddleware = cacheEntityMiddleware(OidcSession, OidcSessionCache);
