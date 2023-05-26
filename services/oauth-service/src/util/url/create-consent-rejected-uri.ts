import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";

export const createConsentRejectedUri = (authorizationSession: AuthorizationSession): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "consent_rejected",
      state: authorizationSession.state,
    },
  }).toString();
