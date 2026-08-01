import type { IAmphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { PylonAuthConfig } from "../../../types/index.js";
import type { PartialOpenIdConfiguration } from "./types.js";

export const getOpenIdConfiguration = (
  ctx: { amphora: IAmphora },
  config: PylonAuthConfig,
): PartialOpenIdConfiguration => {
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

  // OIDC Discovery §3 / RFC 8414 §2 mark exactly these two REQUIRED, and pylon's RP
  // runs the code flow so neither is dispensable. The optional endpoints are handled
  // at their point of use — these two are validated HERE, where the document is
  // adopted, because a document without them is not a usable OP at all.
  const missing: Array<string> = [
    ...(isString(idp.openIdConfiguration.authorizationEndpoint)
      ? []
      : ["authorization_endpoint"]),
    ...(isString(idp.openIdConfiguration.tokenEndpoint) ? [] : ["token_endpoint"]),
  ];

  if (missing.length) {
    throw new ServerError("OpenID configuration is missing required metadata", {
      code: "openid_configuration_incomplete",
      title: "OpenID Configuration Incomplete",
      type: "urn:lindorm:pylon:error:openid_configuration_incomplete",
      details:
        "The upstream IdP's discovery document omits metadata the specs mark REQUIRED (OIDC Discovery §3 / RFC 8414 §2); see the missing wire names in error data. The document cannot be used as an OpenID Provider configuration.",
      data: { issuer: config.issuer, missing },
    });
  }

  // Amphora keeps the fetched document deliberately loose — it names only the two
  // fields IT reads and preserves the rest through an index signature. This is the
  // SINGLE choke-point where the RP claims the endpoints it needs, so the assertion
  // stays here and no downstream reader repeats it.
  return idp.openIdConfiguration as PartialOpenIdConfiguration;
};
