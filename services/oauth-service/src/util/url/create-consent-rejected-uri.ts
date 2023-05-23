import { createURL } from "@lindorm-io/url";
import { AuthorizationRequest } from "../../entity";

export const createConsentRejectedUri = (authorizationRequest: AuthorizationRequest): string =>
  createURL(authorizationRequest.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "consent_rejected",
      state: authorizationRequest.state,
    },
  }).toString();
