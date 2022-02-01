import { LogoutSession, LogoutSessionOptions } from "../../entity";
import { ClientType } from "../../common";

export const getTestLogoutSession = (options: Partial<LogoutSessionOptions> = {}): LogoutSession =>
  new LogoutSession({
    description: "description",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    logoUri: "https://client.logo.uri/",
    name: "name",
    oauthSessionId: "b150db59-ae42-4c9f-b282-c1710a952aed",
    type: ClientType.PUBLIC,
    ...options,
  });
