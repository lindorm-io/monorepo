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
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerRepository,
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

interface ServerCache extends LindormNodeServerCache {
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

interface ServerRepository extends LindormNodeServerRepository {
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
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
  token: ServerToken;
}

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
