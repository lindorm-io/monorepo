import { OidcSession, OidcSessionOptions } from "../../entity";

export const createTestOidcSession = (options: Partial<OidcSessionOptions> = {}): OidcSession =>
  new OidcSession({
    callbackUri: "https://authentication.test.lindorm.io/oidc/callback",
    codeVerifier: "5ecb8e58a432423f8b508f1f81e4eb40",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    provider: "apple",
    nonce: "403bdade9c334da8",
    state: "2bcfd503f8c0471e9e793b54b7840ab135703daa337947c1b6648210768b8d64",
    verified: false,
    ...options,
  });
