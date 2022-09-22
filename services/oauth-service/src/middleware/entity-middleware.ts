import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { AuthorizationSession, Client, ElevationSession, LogoutSession, Tenant } from "../entity";
import {
  AuthorizationSessionCache,
  ClientCache,
  ElevationSessionCache,
  LogoutSessionCache,
  TenantRepository,
} from "../infrastructure";

export const authorizationSessionEntityMiddleware = cacheEntityMiddleware(
  AuthorizationSession,
  AuthorizationSessionCache,
);

export const clientEntityMiddleware = cacheEntityMiddleware(Client, ClientCache);

export const elevationSessionEntityMiddleware = cacheEntityMiddleware(
  ElevationSession,
  ElevationSessionCache,
);

export const logoutSessionEntityMiddleware = cacheEntityMiddleware(
  LogoutSession,
  LogoutSessionCache,
);

export const tenantEntityMiddleware = repositoryEntityMiddleware(Tenant, TenantRepository);
