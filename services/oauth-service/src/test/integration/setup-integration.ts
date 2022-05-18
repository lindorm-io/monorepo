import { CryptoArgon } from "@lindorm-io/crypto";
import { getTestCache } from "./test-cache";
import { getTestKeyPairEC } from "./test-key-pair";
import { getTestRepository } from "./test-repository";
import { argon } from "../../instance";
import {
  AuthorizationSessionCache,
  ClientCache,
  ClientRepository,
  ConsentSessionRepository,
  BrowserSessionRepository,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
} from "../../infrastructure";

export let TEST_AUTHORIZATION_SESSION_CACHE: AuthorizationSessionCache;
export let TEST_CLIENT_CACHE: ClientCache;
export let TEST_INVALID_TOKEN_CACHE: InvalidTokenCache;
export let TEST_LOGOUT_SESSION_CACHE: LogoutSessionCache;

export let TEST_BROWSER_SESSION_REPOSITORY: BrowserSessionRepository;
export let TEST_CLIENT_REPOSITORY: ClientRepository;
export let TEST_CONSENT_SESSION_REPOSITORY: ConsentSessionRepository;
export let TEST_REFRESH_SESSION_REPOSITORY: RefreshSessionRepository;

export let TEST_ARGON: CryptoArgon;

export const setupIntegration = async (): Promise<void> => {
  const {
    authorizationSessionCache,
    clientCache,
    invalidTokenCache,
    keyPairCache,
    logoutSessionCache,
  } = getTestCache();
  const {
    browserSessionRepository,
    clientRepository,
    consentSessionRepository,
    refreshSessionRepository,
  } = getTestRepository();

  TEST_AUTHORIZATION_SESSION_CACHE = authorizationSessionCache;
  TEST_CLIENT_CACHE = clientCache;
  TEST_INVALID_TOKEN_CACHE = invalidTokenCache;
  TEST_LOGOUT_SESSION_CACHE = logoutSessionCache;

  TEST_BROWSER_SESSION_REPOSITORY = browserSessionRepository;
  TEST_CLIENT_REPOSITORY = clientRepository;
  TEST_CONSENT_SESSION_REPOSITORY = consentSessionRepository;
  TEST_REFRESH_SESSION_REPOSITORY = refreshSessionRepository;

  TEST_ARGON = argon;

  await keyPairCache.create(getTestKeyPairEC());
};
