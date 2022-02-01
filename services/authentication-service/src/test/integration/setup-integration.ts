import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { getTestCache } from "./test-cache";
import { getTestKeyPairEC } from "./test-key-pair";
import { getTestRepository } from "./test-repository";
import {
  AccountRepository,
  BrowserLinkRepository,
  ConsentSessionCache,
  FlowSessionCache,
  LoginSessionCache,
  LogoutSessionCache,
  MfaCookieSessionCache,
  OidcSessionCache,
} from "../../infrastructure";

export let TEST_CONSENT_SESSION_CACHE: ConsentSessionCache;
export let TEST_FLOW_SESSION_CACHE: FlowSessionCache;
export let TEST_KEY_PAIR_CACHE: KeyPairCache;
export let TEST_LOGIN_SESSION_CACHE: LoginSessionCache;
export let TEST_LOGOUT_SESSION_CACHE: LogoutSessionCache;
export let TEST_MFA_COOKIE_SESSION_CACHE: MfaCookieSessionCache;
export let TEST_OIDC_SESSION_CACHE: OidcSessionCache;

export let TEST_ACCOUNT_REPOSITORY: AccountRepository;
export let TEST_BROWSER_LINK_REPOSITORY: BrowserLinkRepository;

export const setupIntegration = async (): Promise<void> => {
  const {
    consentSessionCache,
    flowSessionCache,
    keyPairCache,
    loginSessionCache,
    logoutSessionCache,
    mfaCookieSessionCache,
    oidcSessionCache,
  } = await getTestCache();
  const { accountRepository, browserLinkRepository } = await getTestRepository();

  TEST_CONSENT_SESSION_CACHE = consentSessionCache;
  TEST_FLOW_SESSION_CACHE = flowSessionCache;
  TEST_KEY_PAIR_CACHE = keyPairCache;
  TEST_LOGIN_SESSION_CACHE = loginSessionCache;
  TEST_LOGOUT_SESSION_CACHE = logoutSessionCache;
  TEST_MFA_COOKIE_SESSION_CACHE = mfaCookieSessionCache;
  TEST_OIDC_SESSION_CACHE = oidcSessionCache;

  TEST_ACCOUNT_REPOSITORY = accountRepository;
  TEST_BROWSER_LINK_REPOSITORY = browserLinkRepository;

  await keyPairCache.create(getTestKeyPairEC());
};
