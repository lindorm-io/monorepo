import { Axios } from "@lindorm-io/axios";
import { IssuerVerifyData, TokenIssuer } from "@lindorm-io/jwt";
import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { KoaContext } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import {
  Account,
  BrowserLink,
  FlowSession,
  MfaCookieSession,
  LoginSession,
  ConsentSession,
  OidcSession,
  LogoutSession,
} from "../entity";
import {
  AccountRepository,
  BrowserLinkRepository,
  FlowSessionCache,
  MfaCookieSessionCache,
  LoginSessionCache,
  ConsentSessionCache,
  OidcSessionCache,
  LogoutSessionCache,
} from "../infrastructure";

export interface Context<Body = Record<string, any>> extends KoaContext<Body> {
  axios: {
    axiosClient: Axios;
    communicationClient: Axios;
    deviceLinkClient: Axios;
    identityClient: Axios;
    oauthClient: Axios;
  };
  cache: {
    consentSessionCache: ConsentSessionCache;
    flowSessionCache: FlowSessionCache;
    loginSessionCache: LoginSessionCache;
    logoutSessionCache: LogoutSessionCache;
    mfaCookieSessionCache: MfaCookieSessionCache;
    oidcSessionCache: OidcSessionCache;
  };
  connection: {
    mongo: MongoConnection;
    redis: RedisConnection;
  };
  entity: {
    account: Account;
    browserLink: BrowserLink;
    consentSession: ConsentSession;
    flowSession: FlowSession;
    loginSession: LoginSession;
    logoutSession: LogoutSession;
    mfaCookieSession: MfaCookieSession;
    oidcSession: OidcSession;
  };
  jwt: TokenIssuer;
  keys: Array<KeyPair>;
  keystore: Keystore;
  repository: {
    accountRepository: AccountRepository;
    browserLinkRepository: BrowserLinkRepository;
  };
  token: {
    bearerToken: IssuerVerifyData<never, never>;
    challengeConfirmationToken: IssuerVerifyData<unknown, unknown>;
    flowToken: IssuerVerifyData<never, never>;
  };
}
