import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import {
  AuthorizationSession,
  BrowserSession,
  Client,
  ConsentSession,
  LogoutSession,
  Tenant,
} from "../entity";
import {
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientCache,
  ConsentSessionRepository,
  LogoutSessionCache,
  TenantRepository,
} from "../infrastructure";

export const authorizationSessionEntityMiddleware = cacheEntityMiddleware(
  AuthorizationSession,
  AuthorizationSessionCache,
);

export const browserSessionEntityMiddleware = repositoryEntityMiddleware(
  BrowserSession,
  BrowserSessionRepository,
);

export const consentSessionEntityMiddleware = repositoryEntityMiddleware(
  ConsentSession,
  ConsentSessionRepository,
);

export const clientEntityMiddleware = cacheEntityMiddleware(Client, ClientCache);

export const logoutSessionEntityMiddleware = cacheEntityMiddleware(
  LogoutSession,
  LogoutSessionCache,
);

export const tenantEntityMiddleware = repositoryEntityMiddleware(Tenant, TenantRepository);
