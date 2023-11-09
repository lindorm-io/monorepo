import { Scope, SubjectHint, TokenType } from "@lindorm-io/common-enums";
import { LindormIdentityClaims } from "@lindorm-io/common-types";
import { JwtSignOptions, createTestJwt } from "@lindorm-io/jwt";
import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { getUnixTime } from "date-fns";
import { ClientSessionType } from "../../enum";
import { configuration } from "../../server/configuration";

export const getTestIdToken = (
  options: Partial<JwtSignOptions<Partial<LindormIdentityClaims>>> = {},
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
    nonce: randomHex(16),
    scopes: Object.values(Scope),
    session: randomUUID(),
    sessionHint: ClientSessionType.EPHEMERAL,
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    tenant: randomUUID(),
    type: TokenType.ID,
    ...options,
  });

  return token;
};
