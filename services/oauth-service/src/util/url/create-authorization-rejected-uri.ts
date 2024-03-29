import { TransformMode } from "@lindorm-io/case";
import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";

export const createAuthorizationRejectedUri = (
  authorizationSession: AuthorizationSession,
): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      errorDescription: "authorization_rejected",
      state: authorizationSession.state,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
