import { Environment } from "@lindorm-io/common-enums";
import { createURL } from "@lindorm-io/url";
import { LogoutSession } from "../../entity";
import { configuration } from "../../server/configuration";

export const createLogoutVerifyUri = (logoutSession: LogoutSession): string =>
  createURL("/oauth2/sessions/logout/verify", {
    host: configuration.server.host,
    port:
      configuration.server.environment === Environment.DEVELOPMENT
        ? configuration.server.port
        : undefined,
    query: {
      session: logoutSession.id,
      postLogoutRedirectUri: logoutSession.postLogoutRedirectUri,
    },
  }).toString();
