import { createURL } from "@lindorm-io/url";
import { AuthorizationRequest } from "../../entity";

export const createSelectAccountRejectedUri = (
  authorizationRequest: AuthorizationRequest,
): string =>
  createURL(authorizationRequest.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "account_selection_rejected",
      state: authorizationRequest.state,
    },
  }).toString();
