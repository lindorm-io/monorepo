import { Axios } from "@lindorm-io/axios";
import { Dict, LindormIdentityClaims } from "@lindorm-io/common-types";
import { JwtVerify } from "@lindorm-io/jwt";
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
import {
  AuthenticationTokenSession,
  AuthorizationSession,
  BackchannelSession,
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
  BackchannelSessionCache,
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
  backchannelSession: BackchannelSession;
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
  backchannelSessionCache: BackchannelSessionCache;
  claimsSessionCache: ClaimsSessionCache;
  elevationSessionCache: ElevationSessionCache;
  logoutSessionCache: LogoutSessionCache;
  opaqueTokenCache: OpaqueTokenCache;
}

interface ServerToken extends LindormNodeServerToken {
  idToken: JwtVerify<LindormIdentityClaims>;
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
