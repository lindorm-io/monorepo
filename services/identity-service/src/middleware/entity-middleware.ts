import { ConnectSession, Identity } from "../entity";
import { ConnectSessionCache, IdentityRepository } from "../infrastructure";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";

export const connectSessionEntityMiddleware = cacheEntityMiddleware(
  ConnectSession,
  ConnectSessionCache,
);

export const identityEntityMiddleware = repositoryEntityMiddleware(Identity, IdentityRepository);
