import { AuthenticationMethod } from "../../common";
import { ElevationSession, ElevationSessionAttributes } from "../../entity";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const createTestElevationSession = (
  options: Partial<ElevationSessionAttributes> = {},
): ElevationSession =>
  new ElevationSession({
    identifiers: {
      browserSessionId: randomUUID(),
      refreshSessionId: randomUUID(),
    },
    requestedAuthentication: {
      authenticationMethods: [AuthenticationMethod.EMAIL],
      levelHint: 1,
      levelOfAssurance: 2,
      methodHint: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      missingAccessLevel: 1,
    },

    authenticationHint: ["test@lindorm.io"],
    clientId: randomUUID(),
    country: "se",
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    identityId: randomUUID(),
    nonce: randomString(16),
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
