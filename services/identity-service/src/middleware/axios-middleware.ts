import { axiosClientCredentialsMiddleware } from "@lindorm-io/axios";
import { configuration } from "../configuration";

export const clientCredentialsMiddleware = axiosClientCredentialsMiddleware({
  clientEnvironment: configuration.server.environment,
  clientId: configuration.oauth.client_id,
  clientSecret: configuration.oauth.client_secret,
  clientVersion: "1",
});
