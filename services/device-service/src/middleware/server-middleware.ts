import { axiosMiddleware } from "@lindorm-io/koa-axios";
import { cacheMiddleware, redisMiddleware } from "@lindorm-io/koa-redis";
import { configuration } from "../configuration";
import { mongoConnection, redisConnection } from "../instance";
import { mongoMiddleware, repositoryMiddleware } from "@lindorm-io/koa-mongo";
import { tokenIssuerMiddleware } from "@lindorm-io/koa-jwt";
import {
  cacheKeysMiddleware,
  KeyPairCache,
  KeyPairRepository,
  keystoreMiddleware,
} from "@lindorm-io/koa-keystore";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../infrastructure";

export const serverMiddlewares = [
  // Axios

  axiosMiddleware({
    clientName: "axiosClient",
  }),
  axiosMiddleware({
    baseUrl: configuration.services.communication_service,
    clientName: "communicationClient",
  }),
  axiosMiddleware({
    baseUrl: configuration.oauth.host,
    clientName: "oauthClient",
  }),

  // Repository

  mongoMiddleware(mongoConnection),
  repositoryMiddleware(DeviceLinkRepository),
  repositoryMiddleware(KeyPairRepository),

  // Cache

  redisMiddleware(redisConnection),
  cacheMiddleware(ChallengeSessionCache),
  cacheMiddleware(EnrolmentSessionCache),
  cacheMiddleware(RdcSessionCache),
  cacheMiddleware(KeyPairCache),

  // JWT

  cacheKeysMiddleware,
  keystoreMiddleware,
  tokenIssuerMiddleware({
    issuer: configuration.server.host,
  }),
];
