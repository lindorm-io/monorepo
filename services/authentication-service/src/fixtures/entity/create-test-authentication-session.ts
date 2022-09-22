import { AuthenticationMethod, SessionStatus } from "../../common";
import { AuthenticationSession, AuthenticationSessionOptions } from "../../entity";
import { AuthenticationStrategy, AuthenticationMode } from "../../enum";
import { PKCEMethod, randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const createTestAuthenticationSession = (
  options: Partial<AuthenticationSessionOptions> = {},
): AuthenticationSession =>
  new AuthenticationSession({
    allowedStrategies: [
      AuthenticationStrategy.BANK_ID_SE,
      AuthenticationStrategy.DEVICE_CHALLENGE,
      AuthenticationStrategy.EMAIL_LINK,
      AuthenticationStrategy.EMAIL_OTP,
      AuthenticationStrategy.PHONE_OTP,
    ],
    clientId: randomUUID(),
    codeChallenge: randomString(32),
    codeChallengeMethod: PKCEMethod.S256,
    country: "se",
    emailHint: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    mode: AuthenticationMode.OAUTH,
    nonce: randomString(16),
    phoneHint: "0701234567",
    requestedLevel: 4,
    requestedMethods: [AuthenticationMethod.EMAIL],
    status: SessionStatus.PENDING,
    ...options,
  });
