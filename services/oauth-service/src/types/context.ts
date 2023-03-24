import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
import { VerifiedAuthenticationConfirmationToken, VerifiedIdentityToken } from "../common";
import {
  LindormNodeServerAxios,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerMemory,
  LindormNodeServerMongo,
  LindormNodeServerRedis,
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

interface ServerEntity {
  authorizationSession: AuthorizationSession;
  claimsSession: ClaimsSession;
  client: Client;
  clientSession: ClientSession;
  elevationSession: ElevationSession;
  logoutSession: LogoutSession;
  opaqueToken: OpaqueToken;
  tenant: Tenant;
}

interface ServerMongo extends LindormNodeServerMongo {
  browserSessionRepository: BrowserSessionRepository;
  clientRepository: ClientRepository;
  clientSessionRepository: ClientSessionRepository;
  tenantRepository: TenantRepository;
}

interface ServerRedis extends LindormNodeServerRedis {
  authorizationCodeCache: AuthorizationCodeCache;
  authorizationSessionCache: AuthorizationSessionCache;
  claimsSessionCache: ClaimsSessionCache;
  elevationSessionCache: ElevationSessionCache;
  logoutSessionCache: LogoutSessionCache;
  opaqueTokenCache: OpaqueTokenCache;
}

interface ServerToken extends LindormNodeServerToken {
  authenticationConfirmationToken: VerifiedAuthenticationConfirmationToken;
  idToken: VerifiedIdentityToken;
  refreshToken: JwtDecodeData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: ServerMongo;
  redis: ServerRedis;
  token: ServerToken;
}

export interface ServerKoaContext<D extends Dict = Dict>
  extends LindormNodeServerKoaContext<Context, D> {}

export interface ServerKoaController<D extends Dict = Dict>
  extends Controller<ServerKoaContext<D>> {}

export interface ServerKoaMiddleware extends LindormNodeServerKoaMiddleware<ServerKoaContext> {}
