import { LoginSession, LoginSessionOptions } from "../../entity";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const createTestLoginSession = (options: Partial<LoginSessionOptions> = {}): LoginSession =>
  new LoginSession({
    authenticationSessionId: randomUUID(),
    codeVerifier: randomString(32),
    expires: new Date("2022-01-01T09:00:00.000Z"),
    oauthSessionId: randomUUID(),
    remember: false,
    ...options,
  });
