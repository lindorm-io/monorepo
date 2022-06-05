import { LogoutSession, LogoutSessionOptions } from "../../entity";
import { LogoutSessionType } from "../../enum";

export const createTestLogoutSession = (
  options: Partial<LogoutSessionOptions> = {},
): LogoutSession =>
  new LogoutSession({
    clientId: "f0994699-f278-460f-8916-6033682f3da2",
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "jwt.jwt.jwt",
    originalUri: "https://localhost/oauth2/sessions/logout?query=query",
    redirectUri: "https://test.client.lindorm.io/redirect",
    sessionId: "45f5982f-72f3-4e52-9349-ce9ca128678e",
    sessionType: LogoutSessionType.BROWSER,
    state: "YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow",
    ...options,
  });
