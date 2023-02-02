import { AuthorizationSession } from "../../entity";
import { createURL } from "@lindorm-io/url";

export const createLoginRejectedUri = (authorizationSession: AuthorizationSession): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "login_rejected",
      state: authorizationSession.state,
    },
  }).toString();
