import { axiosMiddleware } from "@lindorm-io/koa-axios";
import { cacheMiddleware, redisMiddleware } from "@lindorm-io/koa-redis";
import { configuration } from "../configuration";
import { mongoConnection, redisConnection } from "../instance";
import { mongoMiddleware, repositoryMiddleware } from "@lindorm-io/koa-mongo";
import { tokenIssuerMiddleware } from "@lindorm-io/koa-jwt";
import { KeyPairCache, cacheKeysMiddleware, keystoreMiddleware } from "@lindorm-io/koa-keystore";
import {
  ConnectSessionCache,
  DisplayNameRepository,
  EmailRepository,
  ExternalIdentifierRepository,
  IdentityRepository,
  PhoneNumberRepository,
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
    baseUrl: configuration.services.communication_service,
    clientName: "oauthClient",
  }),

  // Repository

  mongoMiddleware(mongoConnection),
  repositoryMiddleware(DisplayNameRepository),
  repositoryMiddleware(EmailRepository),
  repositoryMiddleware(ExternalIdentifierRepository),
  repositoryMiddleware(IdentityRepository),
  repositoryMiddleware(PhoneNumberRepository),

  // Cache

  redisMiddleware(redisConnection),
  cacheMiddleware(ConnectSessionCache),
  cacheMiddleware(KeyPairCache),

  // JWT

  cacheKeysMiddleware,
  keystoreMiddleware,
  tokenIssuerMiddleware({
    issuer: configuration.server.host,
  }),
];
