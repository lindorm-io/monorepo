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
  AccountRepository,
  BrowserLinkRepository,
  ConsentSessionCache,
  FlowSessionCache,
  LoginSessionCache,
  LogoutSessionCache,
  MfaCookieSessionCache,
  OidcSessionCache,
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
    baseUrl: configuration.services.device_service,
    clientName: "deviceLinkClient",
  }),
  axiosMiddleware({
    baseUrl: configuration.services.identity_service,
    clientName: "identityClient",
  }),
  axiosMiddleware({
    baseUrl: configuration.oauth.host,
    clientName: "oauthClient",
  }),

  // Repository

  mongoMiddleware(mongoConnection),
  repositoryMiddleware(AccountRepository),
  repositoryMiddleware(BrowserLinkRepository),
  repositoryMiddleware(KeyPairRepository),

  // Cache

  redisMiddleware(redisConnection),
  cacheMiddleware(ConsentSessionCache),
  cacheMiddleware(FlowSessionCache),
  cacheMiddleware(KeyPairCache),
  cacheMiddleware(LoginSessionCache),
  cacheMiddleware(LogoutSessionCache),
  cacheMiddleware(MfaCookieSessionCache),
  cacheMiddleware(OidcSessionCache),

  // JWT

  cacheKeysMiddleware,
  keystoreMiddleware,
  tokenIssuerMiddleware({
    issuer: configuration.server.host,
  }),
];
