import { ServerError } from "@lindorm-io/errors";
import { find } from "lodash";
import { configuration } from "../server/configuration";

export const findFederationConfiguration = (key: string) => {
  const config = find(configuration.federation_providers, { key });

  if (!config) {
    throw new ServerError("Provider not found");
  }

  return config;
};
