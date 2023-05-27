import {
  AuthenticationMethod,
  AuthenticationMode,
  AuthenticationStrategy,
  PKCEMethod,
  SessionStatus,
} from "@lindorm-io/common-types";
import { randomHex, randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { AuthenticationSession, AuthenticationSessionOptions } from "../../entity";

export const createTestAuthenticationSession = (
  options: Partial<AuthenticationSessionOptions> = {},
): AuthenticationSession =>
  new AuthenticationSession({
    allowedStrategies: [
      AuthenticationStrategy.BANK_ID_SE,
      AuthenticationStrategy.DEVICE_CHALLENGE,
      AuthenticationStrategy.EMAIL_CODE,
      AuthenticationStrategy.EMAIL_OTP,
      AuthenticationStrategy.PHONE_CODE,
      AuthenticationStrategy.PHONE_OTP,
    ],
    clientId: randomUUID(),
    codeChallenge: randomUnreserved(32),
    codeChallengeMethod: PKCEMethod.SHA256,
    country: "se",
    emailHint: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    minimumLevel: 1,
    mode: AuthenticationMode.OAUTH,
    nonce: randomHex(16),
    phoneHint: "0701234567",
    recommendedLevel: 3,
    recommendedMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    requiredLevel: 4,
    requiredMethods: [AuthenticationMethod.BANK_ID_SE],
    status: SessionStatus.PENDING,
    ...options,
  });
