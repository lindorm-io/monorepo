import { LogoutSession } from "../../entity";
import { createURL } from "@lindorm-io/url";
import { configuration } from "../../server/configuration";
import { Environments } from "@lindorm-io/common-types";

export const createLogoutVerifyUri = (logoutSession: LogoutSession): string =>
  createURL("/oauth2/sessions/logout/verify", {
    host: configuration.server.host,
    port:
      configuration.server.environment === Environments.DEVELOPMENT
        ? configuration.server.port
        : undefined,
    query: {
      session: logoutSession.id,
      postLogoutRedirectUri: logoutSession.postLogoutRedirectUri,
    },
  }).toString();
