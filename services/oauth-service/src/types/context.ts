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

type ServerAxios = LindormNodeServerAxios & {
  authenticationClient: Axios;
  identityClient: Axios;
};

type ServerCache = LindormNodeServerCache & {
  authorizationCodeCache: AuthorizationCodeCache;
  authorizationSessionCache: AuthorizationSessionCache;
  clientCache: ClientCache;
  elevationSessionCache: ElevationSessionCache;
  invalidTokenCache: InvalidTokenCache;
  logoutSessionCache: LogoutSessionCache;
};

type ServerEntity = {
  authorizationSession: AuthorizationSession;
  client: Client;
  elevationSession: ElevationSession;
  logoutSession: LogoutSession;
  tenant: Tenant;
};

type ServerRepository = LindormNodeServerRepository & {
  browserSessionRepository: BrowserSessionRepository;
  clientRepository: ClientRepository;
  consentSessionRepository: ConsentSessionRepository;
  refreshSessionRepository: RefreshSessionRepository;
  tenantRepository: TenantRepository;
};

type ServerToken = LindormNodeServerToken & {
  authenticationConfirmationToken: VerifiedAuthenticationConfirmationToken;
  idToken: VerifiedIdentityToken;
  refreshToken: JwtVerifyData;
};

type Context = LindormNodeServerContext & {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
  token: ServerToken;
};

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
