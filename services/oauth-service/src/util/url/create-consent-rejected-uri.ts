import { TransformMode } from "@lindorm-io/case";
import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";

export const createConsentRejectedUri = (authorizationSession: AuthorizationSession): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      errorDescription: "consent_rejected",
      state: authorizationSession.state,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
