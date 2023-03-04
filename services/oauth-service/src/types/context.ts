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
  AuthorizationSession,
  ClaimsSession,
  Client,
  ClientSession,
  ElevationSession,
  LogoutSession,
  OpaqueToken,
  Tenant,
} from "../entity";
import {
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClaimsSessionCache,
  ClientRepository,
  ClientSessionRepository,
  ElevationSessionCache,
  LogoutSessionCache,
  OpaqueTokenCache,
  TenantRepository,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  identityClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  opaqueTokenCache: OpaqueTokenCache;
  authorizationCodeCache: AuthorizationCodeCache;
  authorizationSessionCache: AuthorizationSessionCache;
  claimsSessionCache: ClaimsSessionCache;
  elevationSessionCache: ElevationSessionCache;
  logoutSessionCache: LogoutSessionCache;
}

interface ServerEntity {
  opaqueToken: OpaqueToken;
  authorizationSession: AuthorizationSession;
  claimsSession: ClaimsSession;
  client: Client;
  clientSession: ClientSession;
  elevationSession: ElevationSession;
  logoutSession: LogoutSession;
  tenant: Tenant;
}

interface ServerRepository extends LindormNodeServerRepository {
  browserSessionRepository: BrowserSessionRepository;
  clientRepository: ClientRepository;
  clientSessionRepository: ClientSessionRepository;
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
