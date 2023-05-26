import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";

export const createSelectAccountRejectedUri = (
  authorizationSession: AuthorizationSession,
): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "account_selection_rejected",
      state: authorizationSession.state,
    },
  }).toString();
