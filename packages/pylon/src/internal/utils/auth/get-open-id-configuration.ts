import type { IAmphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import type { OpenIdConfiguration } from "@lindorm/types";
import type { PylonAuthConfig } from "../../../types/index.js";

export const getOpenIdConfiguration = (
  ctx: { amphora: IAmphora },
  config: PylonAuthConfig,
): OpenIdConfiguration => {
  const configuration = ctx.amphora.config.find((c) => c.issuer === config.issuer);

  if (!configuration) {
    throw new ServerError("OpenID configuration not found", {
      code: "openid_configuration_not_found",
      title: "OpenID Configuration Not Found",
      type: "urn:lindorm:pylon:error:openid_configuration_not_found",
      details:
        "Configuration not found in Amphora. Add the openIdConfigurationUri to the Amphora",
      data: { issuer: config.issuer },
    });
  }

  return configuration as OpenIdConfiguration;
};
