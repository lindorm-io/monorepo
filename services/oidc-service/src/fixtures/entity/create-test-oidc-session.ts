import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { OidcSession, OidcSessionOptions } from "../../entity";

export const createTestOidcSession = (options: Partial<OidcSessionOptions> = {}): OidcSession =>
  new OidcSession({
    callbackId: randomUUID(),
    callbackUri: "https://authentication.test.lindorm.io/oidc/callback",
    codeVerifier: randomHex(43),
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    nonce: randomHex(16),
    provider: "apple",
    state: randomHex(16),
    verified: false,
    ...options,
  });
