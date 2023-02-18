import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { randomString } from "@lindorm-io/random";
import { getUnixTime } from "date-fns";
import { randomUUID } from "crypto";
import { LindormScopes, LindormTokenTypes, SubjectHints } from "@lindorm-io/common-types";
import { ClientScopes } from "../../common";

export const getTestAccessToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    adjustedAccessLevel: 4,
    audiences: [configuration.oauth.client_id, randomUUID()],
    authTime: getUnixTime(new Date()),
    client: randomUUID(),
    expiry: "10 seconds",
    levelOfAssurance: 4,
    nonce: randomString(16),
    scopes: Object.values(LindormScopes),
    session: randomUUID(),
    sessionHint: "access",
    subject: randomUUID(),
    subjectHint: SubjectHints.IDENTITY,
    tenant: randomUUID(),
    type: LindormTokenTypes.ACCESS,
    ...options,
  });
  return token;
};

export const getTestClientCredentials = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id, randomUUID()],
    expiry: "10 seconds",
    scopes: Object.values(ClientScopes),
    subject: randomUUID(),
    subjectHint: SubjectHints.CLIENT,
    type: LindormTokenTypes.ACCESS,
    ...options,
  });
  return token;
};
