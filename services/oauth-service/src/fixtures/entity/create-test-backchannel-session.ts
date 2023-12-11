import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
} from "@lindorm-io/common-enums";
import { randomUUID } from "crypto";
import { BackchannelSession, BackchannelSessionOptions } from "../../entity";

export const createTestBackchannelSession = (
  options: Partial<BackchannelSessionOptions> = {},
): BackchannelSession =>
  new BackchannelSession({
    requestedConsent: {
      audiences: [randomUUID()],
      scopes: [
        Scope.ADDRESS,
        Scope.EMAIL,
        Scope.OFFLINE_ACCESS,
        Scope.OPENID,
        Scope.PHONE,
        Scope.PROFILE,
      ],
      ...(options.requestedConsent || {}),
    },
    requestedLogin: {
      factors: [AuthenticationFactor.TWO_FACTOR],
      identityId: randomUUID(),
      levelOfAssurance: 4,
      methods: [AuthenticationMethod.EMAIL],
      minimumLevelOfAssurance: 2,
      strategies: [AuthenticationStrategy.PHONE_OTP],
      ...(options.requestedLogin || {}),
    },

    bindingMessage: "binding-message",
    clientId: randomUUID(),
    clientNotificationToken: "client-notification.jwt.jwt",
    clientSessionId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    loginHint: "test@lindorm.io",
    loginHintToken: "login-hint.jwt.jwt",
    requestedExpiry: 3600,
    userCode: "user-code",

    ...options,
  });
