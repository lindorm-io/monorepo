import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { getUnixTime } from "date-fns";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { ClientSessionType } from "../../enum";
import {
  LindormClaims,
  LindormScope,
  OpenIdScope,
  OpenIdTokenType,
  SubjectHint,
} from "@lindorm-io/common-types";

export const getTestIdToken = (
  options: Partial<JwtSignOptions<any, Partial<LindormClaims>>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [randomUUID()],
    authContextClass: "loa_3",
    authMethodsReference: ["email", "phone"],
    authTime: getUnixTime(new Date()),
    claims: {},
    client: randomUUID(),
    expiry: "10 seconds",
    levelOfAssurance: 3,
    nonce: randomString(16),
    scopes: [...Object.values(OpenIdScope), ...Object.values(LindormScope)],
    session: randomUUID(),
    sessionHint: ClientSessionType.EPHEMERAL,
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    tenant: randomUUID(),
    type: OpenIdTokenType.ID,
    ...options,
  });

  return token;
};
