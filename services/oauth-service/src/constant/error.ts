import { createURL } from "@lindorm-io/core";
import { configuration } from "../configuration";

export const ERROR_REDIRECT_URI = createURL(configuration.frontend.routes.error, {
  baseUrl: configuration.frontend.base_url,
}).toString();
