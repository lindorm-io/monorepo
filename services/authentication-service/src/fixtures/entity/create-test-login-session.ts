import { LoginSession, LoginSessionOptions } from "../../entity";
import { PKCEMethod } from "@lindorm-io/core";

export const createTestLoginSession = (options: Partial<LoginSessionOptions> = {}): LoginSession =>
  new LoginSession({
    allowedFlows: [],
    allowedOidc: [],
    amrValues: [],
    country: "se",
    deviceLinks: ["b43722f5-34c4-4f2e-befb-c59f87a9fa03"],
    expires: new Date("2022-01-01T08:00.00.000Z"),
    identityId: "f9162629-26bf-453e-b6e6-42182d9da16f",
    levelOfAssurance: 0,
    loginHint: ["test@lindorm.io", "+46705498721"],
    oauthSessionId: "975b54ff-7c4d-42fc-87dd-5f36541df9a9",
    pkceChallenge: "c0a0aaeaf54b4a58bb918411a33b7c24",
    pkceMethod: PKCEMethod.S256,
    remember: true,
    requestedAuthenticationMethods: ["email_otp"],
    requestedLevelOfAssurance: 2,
    sessions: ["765ac486-e72c-49c3-bd01-ddfd5360e24b"],
    ...options,
  });
