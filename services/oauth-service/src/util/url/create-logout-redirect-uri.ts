import { LogoutSession } from "../../entity";
import { createURL } from "@lindorm-io/url";

export const createLogoutRedirectUri = (logoutSession: LogoutSession): string =>
  createURL(logoutSession.postLogoutRedirectUri!, {
    query: { state: logoutSession.state },
  }).toString();
