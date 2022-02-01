import { Axios } from "@lindorm-io/axios";
import { IdentityServiceClaims } from "../common";
import { IssuerVerifyData, TokenIssuer } from "@lindorm-io/jwt";
import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { KeyPairCache, KeyPairRepository } from "@lindorm-io/koa-keystore";
import { KoaContext } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import {
  AuthorizationSession,
  BrowserSession,
  Client,
  ConsentSession,
  InvalidToken,
  LogoutSession,
  RefreshSession,
} from "../entity";
import {
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientCache,
  ClientRepository,
  ConsentSessionRepository,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
} from "../infrastructure";

export interface Context<Body = Record<string, any>> extends KoaContext<Body> {
  axios: {
    axiosClient: Axios;
    authenticationClient: Axios;
    identityClient: Axios;
  };
  cache: {
    authorizationSessionCache: AuthorizationSessionCache;
    clientCache: ClientCache;
    invalidTokenCache: InvalidTokenCache;
    keyPairCache: KeyPairCache;
    logoutSessionCache: LogoutSessionCache;
  };
  connection: {
    mongo: MongoConnection;
    redis: RedisConnection;
  };
  entity: {
    authorizationSession: AuthorizationSession;
    browserSession: BrowserSession;
    client: Client;
    consentSession: ConsentSession;
    invalidToken: InvalidToken;
    logoutSession: LogoutSession;
    refreshSession: RefreshSession;
  };
  jwt: TokenIssuer;
  keys: Array<KeyPair>;
  keystore: Keystore;
  repository: {
    browserSessionRepository: BrowserSessionRepository;
    clientRepository: ClientRepository;
    consentSessionRepository: ConsentSessionRepository;
    keyPairRepository: KeyPairRepository;
    refreshSessionRepository: RefreshSessionRepository;
  };
  token: {
    bearerToken: IssuerVerifyData<never, never>;
    idToken: IssuerVerifyData<never, IdentityServiceClaims>;
    refreshToken: IssuerVerifyData<never, never>;
  };
}
