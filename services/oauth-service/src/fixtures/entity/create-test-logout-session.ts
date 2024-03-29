import { SessionStatus } from "@lindorm-io/common-enums";
import { randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { LogoutSession, LogoutSessionOptions } from "../../entity";

export const createTestLogoutSession = (
  options: Partial<LogoutSessionOptions> = {},
): LogoutSession =>
  new LogoutSession({
    requestedLogout: {
      browserSessionId: randomUUID(),
      clientSessionId: randomUUID(),
    },

    clientId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "jwt.jwt.jwt",
    identityId: randomUUID(),
    logoutHint: "logout-hint",
    originalUri: "https://localhost/oauth2/sessions/logout?query=query",
    postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
    state: randomUnreserved(16),
    status: SessionStatus.PENDING,
    uiLocales: ["en-GB"],

    ...options,
  });
