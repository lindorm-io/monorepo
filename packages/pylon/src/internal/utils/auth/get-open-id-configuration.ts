import type { IAmphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import type { OpenIdConfiguration } from "@lindorm/types";
import type { PylonAuthConfig } from "../../../types/index.js";

export const getOpenIdConfiguration = (
  ctx: { amphora: IAmphora },
  config: PylonAuthConfig,
): OpenIdConfiguration => {
  // The upstream IdP is the amphora `idp`; `config()` throws `idp_not_configured`
  // when none is set — trying to read a configuration that isn't there IS an error.
  const idp = ctx.amphora.idp.config();

  if (idp.issuer !== config.issuer || !idp.openIdConfiguration) {
    throw new ServerError("OpenID configuration not found", {
      code: "openid_configuration_not_found",
      title: "OpenID Configuration Not Found",
      type: "urn:lindorm:pylon:error:openid_configuration_not_found",
      details:
        "The amphora idp is not configured for this issuer, or its discovery document has not been fetched. Register the upstream via amphora.idp.set / the `idp` setting.",
      data: { issuer: config.issuer, idpIssuer: idp.issuer },
    });
  }

  return idp.openIdConfiguration;
};
