import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
import {
  VerifiedAuthenticationConfirmationToken,
  VerifiedChallengeConfirmationToken,
} from "../common";
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
  Account,
  AuthenticationSession,
  BrowserLink,
  MfaCookieSession,
  StrategySession,
} from "../entity";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  MfaCookieSessionCache,
  StrategySessionCache,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  communicationClient: Axios;
  deviceClient: Axios;
  identityClient: Axios;
  oauthClient: Axios;
  oidcClient: Axios;
  vaultClient: Axios;
}

interface ServerRedis extends LindormNodeServerRedis {
  authenticationSessionCache: AuthenticationSessionCache;
  mfaCookieSessionCache: MfaCookieSessionCache;
  strategySessionCache: StrategySessionCache;
}

interface ServerEntity {
  account: Account;
  authenticationSession: AuthenticationSession;
  browserLink: BrowserLink;
  mfaCookieSession: MfaCookieSession;
  strategySession: StrategySession;
}

interface ServerMongo extends LindormNodeServerMongo {
  accountRepository: AccountRepository;
  browserLinkRepository: BrowserLinkRepository;
}

interface ServerToken extends LindormNodeServerToken {
  authenticationConfirmationToken: VerifiedAuthenticationConfirmationToken;
  challengeConfirmationToken: VerifiedChallengeConfirmationToken;
  strategySessionToken: JwtDecodeData;
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
