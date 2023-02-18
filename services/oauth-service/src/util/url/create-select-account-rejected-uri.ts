import { AuthorizationSession } from "../../entity";
import { createURL } from "@lindorm-io/url";

export const createSelectAccountRejectedUri = (
  authorizationSession: AuthorizationSession,
): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "select_account_rejected",
      state: authorizationSession.state,
    },
  }).toString();
