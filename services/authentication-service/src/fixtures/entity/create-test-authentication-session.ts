import { AuthenticationSession, AuthenticationSessionOptions } from "../../entity";
import { SessionStatus } from "../../common";
import { getRandomString, PKCEMethod } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import { AuthenticationMethod } from "../../enum";

export const createTestAuthenticationSession = (
  options: Partial<AuthenticationSessionOptions> = {},
): AuthenticationSession =>
  new AuthenticationSession({
    allowedMethods: [
      AuthenticationMethod.BANK_ID_SE,
      AuthenticationMethod.DEVICE_CHALLENGE,
      AuthenticationMethod.EMAIL_LINK,
      AuthenticationMethod.EMAIL_OTP,
      AuthenticationMethod.PHONE_OTP,
    ],
    clientId: randomUUID(),
    codeChallenge: getRandomString(32),
    codeMethod: PKCEMethod.S256,
    country: "se",
    emailHint: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    loginSessionId: randomUUID(),
    nonce: getRandomString(16),
    phoneHint: "0701234567",
    redirectUri: "https://redirect.uri",
    requestedLevelOfAssurance: 4,
    requestedMethods: [AuthenticationMethod.EMAIL_OTP],
    status: SessionStatus.PENDING,
    ...options,
  });
