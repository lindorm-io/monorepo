import { Scope, SubjectHint, TokenType } from "@lindorm-io/common-enums";
import { JwtSignOptions, createTestJwt } from "@lindorm-io/jwt";
import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { getUnixTime } from "date-fns";
import { configuration } from "../../server/configuration";

export const getTestAccessToken = (options: Partial<JwtSignOptions> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    adjustedAccessLevel: 4,
    audiences: [configuration.oauth.client_id, randomUUID()],
    authTime: getUnixTime(new Date()),
    client: randomUUID(),
    expiry: "10 seconds",
    levelOfAssurance: 4,
    nonce: randomHex(16),
    scopes: Object.values(Scope),
    session: randomUUID(),
    sessionHint: "access",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    tenant: randomUUID(),
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};

export const getTestClientCredentials = (options: Partial<JwtSignOptions> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id, randomUUID()],
    expiry: "10 seconds",
    scopes: [],
    subject: randomUUID(),
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};
