import { AuthorizationSession, Client, ElevationSession, LogoutSession, Tenant } from "../entity";
import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { JwtVerifyData } from "@lindorm-io/jwt";
import { VerifiedAuthenticationConfirmationToken, VerifiedIdentityToken } from "../common";
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
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientCache,
  ClientRepository,
  ConsentSessionRepository,
  ElevationSessionCache,
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
  authorizationCodeCache: AuthorizationCodeCache;
  authorizationSessionCache: AuthorizationSessionCache;
  clientCache: ClientCache;
  elevationSessionCache: ElevationSessionCache;
  invalidTokenCache: InvalidTokenCache;
  logoutSessionCache: LogoutSessionCache;
}

interface ServerEntity {
  authorizationSession: AuthorizationSession;
  client: Client;
  elevationSession: ElevationSession;
  logoutSession: LogoutSession;
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
  authenticationConfirmationToken: VerifiedAuthenticationConfirmationToken;
  idToken: VerifiedIdentityToken;
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
