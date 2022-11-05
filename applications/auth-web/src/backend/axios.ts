import { Axios } from "@lindorm-io/axios";
import { logger } from "./logger";

export const authClient = new Axios({
  logger,
  name: "AuthenticationClient",
  host: "http://localhost",
  port: 3001,
});

export const oauthClient = new Axios({
  logger,
  name: "OAuthClient",
  host: "http://localhost",
  port: 3005,
});
