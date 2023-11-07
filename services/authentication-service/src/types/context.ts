import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
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
import { AuthenticationConfirmationTokenClaims, ChallengeConfirmationTokenClaims } from "../common";
import {
  Account,
  AuthenticationSession,
  BrowserLink,
  MfaCookieSession,
  StrategySession,
} from "../entity";
import {
  AccountRepository,
  AuthenticationConfirmationTokenCache,
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
  federationClient: Axios;
  vaultClient: Axios;
}

interface ServerRedis extends LindormNodeServerRedis {
  authenticationSessionCache: AuthenticationSessionCache;
  authenticationConfirmationTokenCache: AuthenticationConfirmationTokenCache;
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
  authenticationConfirmationToken: JwtVerify<AuthenticationConfirmationTokenClaims>;
  challengeConfirmationToken: JwtVerify<ChallengeConfirmationTokenClaims>;
  strategySessionToken: JwtVerify;
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
