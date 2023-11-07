import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { FederationSession, FederationSessionOptions } from "../../entity";

export const createTestFederationSession = (
  options: Partial<FederationSessionOptions> = {},
): FederationSession =>
  new FederationSession({
    callbackId: randomUUID(),
    callbackUri: "https://authentication.test.lindorm.io/federation/callback",
    codeVerifier: randomHex(43),
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    nonce: randomHex(16),
    provider: "apple",
    state: randomHex(16),
    verified: false,
    ...options,
  });
