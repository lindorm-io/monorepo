import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
import { Controller } from "@lindorm-io/koa";
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
import { VerifiedIdentityToken } from "../common";
import {
  AuthenticationTokenSession,
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
  AuthenticationTokenSessionCache,
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
  authenticationClient: Axios;
  identityClient: Axios;
}

interface ServerEntity {
  authenticationTokenSession: AuthenticationTokenSession;
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
  authenticationTokenSessionCache: AuthenticationTokenSessionCache;
  authorizationCodeCache: AuthorizationCodeCache;
  authorizationSessionCache: AuthorizationSessionCache;
  claimsSessionCache: ClaimsSessionCache;
  elevationSessionCache: ElevationSessionCache;
  logoutSessionCache: LogoutSessionCache;
  opaqueTokenCache: OpaqueTokenCache;
}

interface ServerToken extends LindormNodeServerToken {
  idToken: VerifiedIdentityToken;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: ServerMongo;
  redis: ServerRedis;
  token: ServerToken;
}

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
