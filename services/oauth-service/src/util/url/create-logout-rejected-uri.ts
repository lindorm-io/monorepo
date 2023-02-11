import { LogoutSession } from "../../entity";
import { createURL } from "@lindorm-io/url";

export const createLogoutRejectedUri = (logoutSession: LogoutSession): string =>
  createURL(logoutSession.redirectUri!, {
    query: {
      error: "request_rejected",
      error_description: "logout_rejected",
      state: logoutSession.state,
    },
  }).toString();
