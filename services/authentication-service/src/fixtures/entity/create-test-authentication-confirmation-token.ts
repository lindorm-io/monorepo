import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-types";
import { randomString, randomToken } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  AuthenticationConfirmationToken,
  AuthenticationConfirmationTokenOptions,
} from "../../entity";

export const createTestAuthenticationConfirmationToken = (
  options: Partial<AuthenticationConfirmationTokenOptions> = {},
): AuthenticationConfirmationToken =>
  new AuthenticationConfirmationToken({
    clientId: randomUUID(),
    confirmedIdentifiers: ["test@lindorm.io", "0701234567"],
    country: "se",
    expires: new Date("2022-01-01T08:01:00.000Z"),
    factors: [AuthenticationFactor.TWO_FACTOR],
    identityId: randomUUID(),
    levelOfAssurance: 1,
    maximumLevelOfAssurance: 1,
    metadata: {},
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    nonce: randomString(16),
    remember: true,
    sessionId: randomUUID(),
    signature: randomToken(128),
    singleSignOn: true,
    strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],

    ...options,
  });
