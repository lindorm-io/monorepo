import { IAmphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import { OpenIdConfiguration } from "@lindorm/types";
import { PylonAuthConfig } from "../../../types";

export const getOpenIdConfiguration = (
  ctx: { amphora: IAmphora },
  config: PylonAuthConfig,
): OpenIdConfiguration => {
  const configuration = ctx.amphora.config.find((c) => c.issuer === config.issuer);

  if (!configuration) {
    throw new ServerError("OpenID configuration not found", {
      details:
        "Configuration not found in Amphora. Add the openIdConfigurationUri to the Amphora",
    });
  }

  return configuration as OpenIdConfiguration;
};
