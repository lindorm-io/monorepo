import { ServerError } from "@lindorm-io/errors";
import { configuration } from "../server/configuration";
import { find } from "lodash";

export const findOidcConfiguration = (key: string) => {
  const config = find(configuration.oidc_providers, { key });

  if (!config) {
    throw new ServerError("Provider not found");
  }

  return config;
};
