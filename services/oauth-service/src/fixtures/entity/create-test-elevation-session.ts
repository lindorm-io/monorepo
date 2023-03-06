import { AuthenticationMethod } from "@lindorm-io/common-types";
import { ElevationSession, ElevationSessionAttributes } from "../../entity";
import { randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const createTestElevationSession = (
  options: Partial<ElevationSessionAttributes> = {},
): ElevationSession =>
  new ElevationSession({
    requestedAuthentication: {
      minimumLevel: 1,
      recommendedLevel: 1,
      recommendedMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      requiredLevel: 2,
      requiredMethods: [AuthenticationMethod.EMAIL],
    },

    authenticationHint: ["test@lindorm.io"],
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    clientSessionId: randomUUID(),
    country: "se",
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    identityId: randomUUID(),
    nonce: randomUnreserved(16),
    redirectUri: "https://test.client.lindorm.io/redirect",
    state: randomUnreserved(16),
    uiLocales: ["sv-SE", "en-GB"],

    ...options,
  });
