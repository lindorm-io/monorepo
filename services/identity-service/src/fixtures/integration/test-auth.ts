import { Scope, SubjectHint, TokenType } from "@lindorm-io/common-enums";
import { JwtSignOptions, createTestJwt } from "@lindorm-io/jwt";
import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { getUnixTime } from "date-fns";
import { configuration } from "../../server/configuration";

export const getTestAccessToken = (options: Partial<JwtSignOptions> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    adjustedAccessLevel: 4,
    audiences: [configuration.oauth.client_id, randomUUID()],
    authTime: getUnixTime(new Date()),
    expiry: "10 seconds",
    levelOfAssurance: 4,
    nonce: randomHex(16),
    scopes: Object.values(Scope),
    sessionHint: "browser",
    session: randomUUID(),
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};

export const getTestClientCredentials = (options: Partial<JwtSignOptions> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id, randomUUID()],
    expiry: "10 seconds",
    subject: randomUUID(),
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};
