import { axiosMiddleware } from "@lindorm-io/koa-axios";
import { cacheMiddleware, redisMiddleware } from "@lindorm-io/koa-redis";
import { configuration } from "../configuration";
import { mongoConnection, redisConnection } from "../instance";
import { mongoMiddleware, repositoryMiddleware } from "@lindorm-io/koa-mongo";
import { tokenIssuerMiddleware } from "@lindorm-io/koa-jwt";
import {
  KeyPairCache,
  KeyPairRepository,
  cacheKeysMiddleware,
  keystoreMiddleware,
} from "@lindorm-io/koa-keystore";
import {
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientCache,
  ClientRepository,
  ConsentSessionRepository,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
} from "../infrastructure";

export const serverMiddlewares = [
  // Axios

  axiosMiddleware({
    clientName: "axiosClient",
  }),
  axiosMiddleware({
    baseUrl: configuration.services.authentication_service,
    clientName: "authenticationClient",
  }),
  axiosMiddleware({
    baseUrl: configuration.services.identity_service,
    clientName: "identityClient",
  }),

  // Repository

  mongoMiddleware(mongoConnection),
  repositoryMiddleware(BrowserSessionRepository),
  repositoryMiddleware(ClientRepository),
  repositoryMiddleware(ConsentSessionRepository),
  repositoryMiddleware(KeyPairRepository),
  repositoryMiddleware(RefreshSessionRepository),

  // Cache

  redisMiddleware(redisConnection),
  cacheMiddleware(AuthorizationSessionCache),
  cacheMiddleware(ClientCache),
  cacheMiddleware(InvalidTokenCache),
  cacheMiddleware(KeyPairCache),
  cacheMiddleware(LogoutSessionCache),

  // JWT

  cacheKeysMiddleware,
  keystoreMiddleware,
  tokenIssuerMiddleware({
    issuer: configuration.server.host,
  }),
];
