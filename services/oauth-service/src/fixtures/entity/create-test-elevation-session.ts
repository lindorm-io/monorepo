import { ElevationSession, ElevationSessionAttributes } from "../../entity";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { AuthenticationMethods } from "@lindorm-io/common-types";

export const createTestElevationSession = (
  options: Partial<ElevationSessionAttributes> = {},
): ElevationSession =>
  new ElevationSession({
    identifiers: {
      browserSessionId: randomUUID(),
      refreshSessionId: randomUUID(),
    },
    requestedAuthentication: {
      minimumLevel: 1,
      recommendedLevel: 1,
      recommendedMethods: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
      requiredLevel: 2,
      requiredMethods: [AuthenticationMethods.EMAIL],
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
