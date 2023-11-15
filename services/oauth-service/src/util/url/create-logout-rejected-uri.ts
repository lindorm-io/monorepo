import { TransformMode } from "@lindorm-io/case";
import { createURL } from "@lindorm-io/url";
import { LogoutSession } from "../../entity";

export const createLogoutRejectedUri = (logoutSession: LogoutSession): string =>
  createURL(logoutSession.postLogoutRedirectUri!, {
    query: {
      error: "request_rejected",
      errorDescription: "logout_rejected",
      state: logoutSession.state,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
