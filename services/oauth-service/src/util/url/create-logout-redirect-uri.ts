import { TransformMode } from "@lindorm-io/case";
import { createURL } from "@lindorm-io/url";
import { LogoutSession } from "../../entity";

export const createLogoutRedirectUri = (logoutSession: LogoutSession): string =>
  createURL(logoutSession.postLogoutRedirectUri!, {
    query: {
      state: logoutSession.state,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
