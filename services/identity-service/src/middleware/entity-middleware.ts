import { ConnectSession, Identifier, Identity } from "../entity";
import { ConnectSessionCache, IdentifierRepository, IdentityRepository } from "../infrastructure";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";

export const connectSessionEntityMiddleware = cacheEntityMiddleware(
  ConnectSession,
  ConnectSessionCache,
);

export const identifierEntityMiddleware = repositoryEntityMiddleware(
  Identifier,
  IdentifierRepository,
);

export const identityEntityMiddleware = repositoryEntityMiddleware(Identity, IdentityRepository);
