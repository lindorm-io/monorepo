import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { JwtVerifyData } from "@lindorm-io/jwt";
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
  ConsentSession,
  LoginSession,
  LogoutSession,
  MfaCookieSession,
  StrategySession,
} from "../entity";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  ConsentSessionCache,
  LoginSessionCache,
  LogoutSessionCache,
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
  consentSessionCache: ConsentSessionCache;
  loginSessionCache: LoginSessionCache;
  logoutSessionCache: LogoutSessionCache;
  mfaCookieSessionCache: MfaCookieSessionCache;
  strategySessionCache: StrategySessionCache;
}

interface ServerEntity {
  account: Account;
  authenticationSession: AuthenticationSession;
  browserLink: BrowserLink;
  consentSession: ConsentSession;
  loginSession: LoginSession;
  logoutSession: LogoutSession;
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
  strategySessionToken: JwtVerifyData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
  token: ServerToken;
}

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
