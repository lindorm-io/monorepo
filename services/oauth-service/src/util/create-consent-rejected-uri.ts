import { AuthorizationSession } from "../entity";
import { createURL } from "@lindorm-io/core";

export const createConsentRejectedUri = (authorizationSession: AuthorizationSession): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      error_description: "consent_rejected",
      state: authorizationSession.state,
    },
  }).toString();
