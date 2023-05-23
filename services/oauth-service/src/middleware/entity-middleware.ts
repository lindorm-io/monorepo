import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";
import {
  AuthorizationRequest,
  ClaimsRequest,
  Client,
  ElevationRequest,
  LogoutSession,
  Tenant,
} from "../entity";
import {
  AuthorizationRequestCache,
  ClaimsRequestCache,
  ClientRepository,
  ElevationRequestCache,
  LogoutSessionCache,
  TenantRepository,
} from "../infrastructure";

export const AuthorizationRequestEntityMiddleware = redisRepositoryEntityMiddleware(
  AuthorizationRequest,
  AuthorizationRequestCache,
);

export const ClaimsRequestEntityMiddleware = redisRepositoryEntityMiddleware(
  ClaimsRequest,
  ClaimsRequestCache,
);

export const clientEntityMiddleware = mongoRepositoryEntityMiddleware(Client, ClientRepository);

export const ElevationRequestEntityMiddleware = redisRepositoryEntityMiddleware(
  ElevationRequest,
  ElevationRequestCache,
);

export const logoutSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  LogoutSession,
  LogoutSessionCache,
);

export const tenantEntityMiddleware = mongoRepositoryEntityMiddleware(Tenant, TenantRepository);
