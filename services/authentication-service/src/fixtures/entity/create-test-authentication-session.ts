import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationMode,
  AuthenticationStrategy,
  PKCEMethod,
  SessionStatus,
} from "@lindorm-io/common-enums";
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
    idTokenLevelOfAssurance: 3,
    idTokenMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    minimumLevelOfAssurance: 1,
    mode: AuthenticationMode.OAUTH,
    nonce: randomHex(16),
    phoneHint: "0701234567",
    requiredFactors: [AuthenticationFactor.TWO_FACTOR],
    requiredLevelOfAssurance: 4,
    requiredMethods: [AuthenticationMethod.DEVICE_LINK],
    requiredStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
    status: SessionStatus.PENDING,
    ...options,
  });
