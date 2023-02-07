import { AuthenticationSession, AuthenticationSessionOptions } from "../../entity";
import { PKCEMethod } from "@lindorm-io/node-pkce";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  AuthenticationMethods,
  AuthenticationModes,
  AuthenticationStrategies,
  SessionStatuses,
} from "@lindorm-io/common-types";

export const createTestAuthenticationSession = (
  options: Partial<AuthenticationSessionOptions> = {},
): AuthenticationSession =>
  new AuthenticationSession({
    allowedStrategies: [
      AuthenticationStrategies.BANK_ID_SE,
      AuthenticationStrategies.DEVICE_CHALLENGE,
      AuthenticationStrategies.EMAIL_LINK,
      AuthenticationStrategies.EMAIL_OTP,
      AuthenticationStrategies.PHONE_OTP,
    ],
    clientId: randomUUID(),
    codeChallenge: randomString(32),
    codeChallengeMethod: PKCEMethod.S256,
    country: "se",
    emailHint: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    minimumLevel: 1,
    mode: AuthenticationModes.OAUTH,
    nonce: randomString(16),
    phoneHint: "0701234567",
    recommendedLevel: 3,
    recommendedMethods: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
    requiredLevel: 4,
    requiredMethods: [AuthenticationMethods.BANK_ID_SE],
    status: SessionStatuses.PENDING,
    ...options,
  });
