import { LogoutSession } from "../entity";
import { createURL } from "@lindorm-io/core";

export const createLogoutRedirectUri = (logoutSession: LogoutSession): string => {
  return createURL(logoutSession.redirectUri, {
    query: { state: logoutSession.state },
  }).toString();
};
