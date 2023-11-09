import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { ElevationSession, ElevationSessionAttributes } from "../../entity";

export const createTestElevationSession = (
  options: Partial<ElevationSessionAttributes> = {},
): ElevationSession => {
  return new ElevationSession({
    requestedAuthentication: {
      factors: [AuthenticationFactor.TWO_FACTOR],
      levelOfAssurance: 4,
      methods: [AuthenticationMethod.EMAIL],
      minimumLevelOfAssurance: 2,
      strategies: [AuthenticationStrategy.PHONE_OTP],
      ...(options.requestedAuthentication || {}),
    },

    authenticationHint: ["test@lindorm.io"],
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    clientSessionId: randomUUID(),
    country: "se",
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    identityId: randomUUID(),
    nonce: randomHex(16),
    redirectUri: "https://test.client.lindorm.io/redirect",
    state: randomHex(16),
    uiLocales: ["sv-SE", "en-GB"],

    ...options,
  });
};
