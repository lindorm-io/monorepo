import { LindormScope, OpenIdScope, OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { getUnixTime } from "date-fns";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const getTestAccessToken = (options: Partial<JwtSignOptions> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    adjustedAccessLevel: 4,
    audiences: [configuration.oauth.client_id, randomUUID()],
    authTime: getUnixTime(new Date()),
    expiry: "10 seconds",
    levelOfAssurance: 4,
    nonce: randomString(16),
    scopes: [...Object.values(OpenIdScope), ...Object.values(LindormScope)],
    sessionHint: "browser",
    session: randomUUID(),
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: OpenIdTokenType.ACCESS,
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
    type: OpenIdTokenType.ACCESS,
    ...options,
  });
  return token;
};
