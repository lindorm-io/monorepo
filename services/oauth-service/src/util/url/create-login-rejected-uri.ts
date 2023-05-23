import { createURL } from "@lindorm-io/url";
import { AuthorizationRequest } from "../../entity";

export const createLoginRejectedUri = (authorizationRequest: AuthorizationRequest): string =>
  createURL(authorizationRequest.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "login_rejected",
      state: authorizationRequest.state,
    },
  }).toString();
