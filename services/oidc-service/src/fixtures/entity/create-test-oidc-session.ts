import { OidcSession, OidcSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/core";

export const createTestOidcSession = (options: Partial<OidcSessionOptions> = {}): OidcSession =>
  new OidcSession({
    callbackId: randomUUID(),
    callbackUri: "https://authentication.test.lindorm.io/oidc/callback",
    codeVerifier: randomString(43),
    expires: new Date("2022-01-01T08:00:00.000Z"),
    provider: "apple",
    nonce: randomString(16),
    state: randomString(16),
    verified: false,
    ...options,
  });
