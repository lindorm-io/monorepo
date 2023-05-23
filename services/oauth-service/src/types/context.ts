import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
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
  AuthorizationRequest,
  ClaimsRequest,
  Client,
  ClientSession,
  ElevationRequest,
  LogoutSession,
  OpaqueToken,
  Tenant,
} from "../entity";
import {
  AuthorizationCodeCache,
  AuthorizationRequestCache,
  BrowserSessionRepository,
  ClaimsRequestCache,
  ClientRepository,
  ClientSessionRepository,
  ElevationRequestCache,
  LogoutSessionCache,
  OpaqueTokenCache,
  TenantRepository,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  identityClient: Axios;
}

interface ServerEntity {
  authorizationRequest: AuthorizationRequest;
  claimsRequest: ClaimsRequest;
  client: Client;
  clientSession: ClientSession;
  elevationRequest: ElevationRequest;
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
  authorizationRequestCache: AuthorizationRequestCache;
  claimsRequestCache: ClaimsRequestCache;
  elevationRequestCache: ElevationRequestCache;
  logoutSessionCache: LogoutSessionCache;
  opaqueTokenCache: OpaqueTokenCache;
}

interface ServerToken extends LindormNodeServerToken {
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

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
