import { createURL } from "@lindorm-io/core";
import { configuration } from "../server/configuration";

export const ERROR_REDIRECT_URI = createURL(configuration.frontend.routes.error, {
  host: configuration.frontend.host,
  port: configuration.frontend.port,
}).toString();
