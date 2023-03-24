import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";
import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import {
  AuthorizationSession,
  ClaimsSession,
  Client,
  ElevationSession,
  LogoutSession,
  Tenant,
} from "../entity";
import {
  AuthorizationSessionCache,
  ClaimsSessionCache,
  ClientRepository,
  ElevationSessionCache,
  LogoutSessionCache,
  TenantRepository,
} from "../infrastructure";

export const authorizationSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  AuthorizationSession,
  AuthorizationSessionCache,
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
