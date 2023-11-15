import { TransformMode } from "@lindorm-io/case";
import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";

export const createSelectAccountRejectedUri = (
  authorizationSession: AuthorizationSession,
): string =>
  createURL(authorizationSession.redirectUri, {
    query: {
      error: "request_rejected",
      errorDescription: "account_selection_rejected",
      state: authorizationSession.state,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
