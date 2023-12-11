import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";
import {
  AuthenticationTokenSession,
  AuthorizationSession,
  BackchannelSession,
  ClaimsSession,
  Client,
  ElevationSession,
  LogoutSession,
  Tenant,
} from "../entity";
import {
  AuthenticationTokenSessionCache,
  AuthorizationSessionCache,
  BackchannelSessionCache,
  ClaimsSessionCache,
  ClientRepository,
  ElevationSessionCache,
  LogoutSessionCache,
  TenantRepository,
} from "../infrastructure";

export const authenticationTokenSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  AuthenticationTokenSession,
  AuthenticationTokenSessionCache,
);

export const authorizationSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  AuthorizationSession,
  AuthorizationSessionCache,
);

export const backchannelSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  BackchannelSession,
  BackchannelSessionCache,
);

export const claimsSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  ClaimsSession,
  ClaimsSessionCache,
);

export const clientEntityMiddleware = mongoRepositoryEntityMiddleware(Client, ClientRepository);

export const elevationSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  ElevationSession,
  ElevationSessionCache,
);

export const logoutSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  LogoutSession,
  LogoutSessionCache,
);

export const tenantEntityMiddleware = mongoRepositoryEntityMiddleware(Tenant, TenantRepository);
