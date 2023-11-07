import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";
import { FederationSession } from "../entity";
import { FederationSessionCache } from "../infrastructure";

export const federationSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  FederationSession,
  FederationSessionCache,
);
