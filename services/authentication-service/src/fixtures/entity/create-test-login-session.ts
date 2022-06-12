import { LoginSession, LoginSessionOptions } from "../../entity";
import { PKCEMethod } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import { FlowType } from "../../enum";

export const createTestLoginSession = (options: Partial<LoginSessionOptions> = {}): LoginSession =>
  new LoginSession({
    allowedFlows: [
      FlowType.BANK_ID_SE,
      FlowType.DEVICE_CHALLENGE,
      FlowType.EMAIL_LINK,
      FlowType.EMAIL_OTP,
      FlowType.PASSWORD,
      FlowType.PHONE_OTP,
      FlowType.RDC_QR_CODE,
      FlowType.SESSION_ACCEPT_WITH_CODE,
      FlowType.WEBAUTHN,
    ],
    allowedOidc: ["apple", "google", "microsoft"],
    amrValues: [],
    country: "se",
    deviceLinks: [randomUUID()],
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    levelOfAssurance: 0,
    loginHint: ["test@lindorm.io", "+46705498721"],
    oauthSessionId: randomUUID(),
    pkceChallenge: "c0a0aaeaf54b4a58bb918411a33b7c24",
    pkceMethod: PKCEMethod.S256,
    remember: true,
    requestedAuthenticationMethods: ["email_otp"],
    requestedLevelOfAssurance: 4,
    sessions: [randomUUID(), randomUUID()],
    ...options,
  });
