import { AuthorizationSession, Client, ElevationSession, LogoutSession, Tenant } from "../entity";
import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
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
  AccessSessionRepository,
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientRepository,
  ElevationSessionCache,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
  TenantRepository,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  identityClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  authorizationCodeCache: AuthorizationCodeCache;
  authorizationSessionCache: AuthorizationSessionCache;
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
  accessSessionRepository: AccessSessionRepository;
  browserSessionRepository: BrowserSessionRepository;
  clientRepository: ClientRepository;
  refreshSessionRepository: RefreshSessionRepository;
  tenantRepository: TenantRepository;
}

interface ServerToken extends LindormNodeServerToken {
  authenticationConfirmationToken: VerifiedAuthenticationConfirmationToken;
  idToken: VerifiedIdentityToken;
  refreshToken: JwtDecodeData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
  token: ServerToken;
}

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
