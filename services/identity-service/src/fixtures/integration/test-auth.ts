import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { getUnixTime } from "date-fns";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  ClientPermission,
  ClientScope,
  IdentityPermission,
  Scope,
  SubjectHint,
  TokenType,
} from "../../common";

export const getTestAccessToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    adjustedAccessLevel: 4,
    audiences: [configuration.oauth.client_id, randomUUID()],
    authTime: getUnixTime(new Date()),
    expiry: "10 seconds",
    levelOfAssurance: 4,
    nonce: randomString(16),
    permissions: Object.values(IdentityPermission),
    scopes: Object.values(Scope),
    sessionId: randomUUID(),
    sessionHint: "browser",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};

export const getTestClientCredentials = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id, randomUUID()],
    expiry: "10 seconds",
    permissions: Object.values(ClientPermission),
    scopes: Object.values(ClientScope),
    subject: randomUUID(),
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};
