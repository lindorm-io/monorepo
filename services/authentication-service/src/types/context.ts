import { Axios } from "@lindorm-io/axios";
import { IssuerVerifyData } from "@lindorm-io/jwt";
import { Controller } from "@lindorm-io/koa";
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
  BrowserLink,
  FlowSession,
  MfaCookieSession,
  LoginSession,
  ConsentSession,
  LogoutSession,
} from "../entity";
import {
  AccountRepository,
  BrowserLinkRepository,
  FlowSessionCache,
  MfaCookieSessionCache,
  LoginSessionCache,
  ConsentSessionCache,
  LogoutSessionCache,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  communicationClient: Axios;
  deviceLinkClient: Axios;
  identityClient: Axios;
  oauthClient: Axios;
  oidcClient: Axios;
  vaultClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  consentSessionCache: ConsentSessionCache;
  flowSessionCache: FlowSessionCache;
  loginSessionCache: LoginSessionCache;
  logoutSessionCache: LogoutSessionCache;
  mfaCookieSessionCache: MfaCookieSessionCache;
}

interface ServerEntity {
  account: Account;
  browserLink: BrowserLink;
  consentSession: ConsentSession;
  flowSession: FlowSession;
  loginSession: LoginSession;
  logoutSession: LogoutSession;
  mfaCookieSession: MfaCookieSession;
}

interface ServerRepository extends LindormNodeServerRepository {
  accountRepository: AccountRepository;
  browserLinkRepository: BrowserLinkRepository;
}

interface ServerToken extends LindormNodeServerToken {
  challengeConfirmationToken: IssuerVerifyData<unknown, unknown>;
  flowToken: IssuerVerifyData<never, never>;
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
