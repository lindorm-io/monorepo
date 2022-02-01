import { OidcSession, OidcSessionOptions } from "../../entity";

export const getTestOidcSession = (options: Partial<OidcSessionOptions> = {}): OidcSession =>
  new OidcSession({
    codeVerifier: "5ecb8e58a432423f8b508f1f81e4eb40",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityProvider: "apple",
    loginSessionId: "7c7ffd94-a9d2-4dc4-90fb-4f4444b60c1c",
    nonce: "403bdade9c334da8",
    redirectUri: "https://authentication.redirect.uri/",
    scope: "openid email phone",
    state: "2bcfd503f8c0471e9e793b54b7840ab135703daa337947c1b6648210768b8d64",
    ...options,
  });
