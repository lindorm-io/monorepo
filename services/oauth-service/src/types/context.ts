import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { IdentityServiceClaims } from "../common";
import { JwtVerifyData } from "@lindorm-io/jwt";
import {
  LindormNodeServerAxios,
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerRepository,
  LindormNodeServerToken,
} from "@lindorm-io/node-server";
import {
  AuthorizationSession,
  BrowserSession,
  Client,
  ConsentSession,
  InvalidToken,
  LogoutSession,
  RefreshSession,
  Tenant,
} from "../entity";
import {
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientCache,
  ClientRepository,
  ConsentSessionRepository,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
  TenantRepository,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  authenticationClient: Axios;
  identityClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  authorizationSessionCache: AuthorizationSessionCache;
  clientCache: ClientCache;
  invalidTokenCache: InvalidTokenCache;
  logoutSessionCache: LogoutSessionCache;
}

interface ServerEntity {
  authorizationSession: AuthorizationSession;
  browserSession: BrowserSession;
  client: Client;
  consentSession: ConsentSession;
  invalidToken: InvalidToken;
  logoutSession: LogoutSession;
  refreshSession: RefreshSession;
  tenant: Tenant;
}

interface ServerRepository extends LindormNodeServerRepository {
  browserSessionRepository: BrowserSessionRepository;
  clientRepository: ClientRepository;
  consentSessionRepository: ConsentSessionRepository;
  refreshSessionRepository: RefreshSessionRepository;
  tenantRepository: TenantRepository;
}

interface ServerToken extends LindormNodeServerToken {
  idToken: JwtVerifyData<never, IdentityServiceClaims>;
  refreshToken: JwtVerifyData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
  token: ServerToken;
}

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
