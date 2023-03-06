import { LindormScope, OpenIdScope, OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { getUnixTime } from "date-fns";
import { randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";

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
    nonce: randomUnreserved(16),
    scopes: [...Object.values(OpenIdScope), ...Object.values(LindormScope)],
    session: randomUUID(),
    sessionHint: "access",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    tenant: randomUUID(),
    type: OpenIdTokenType.ACCESS,
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
    type: OpenIdTokenType.ACCESS,
    ...options,
  });
  return token;
};
