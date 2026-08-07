import { ServerError } from "@lindorm/errors";
import type { PylonAuthClient } from "../../../types/index.js";

const notConfigured = (method: string): never => {
  throw new ServerError(
    `ctx.auth.${method}() called but options.auth is not configured`,
    {
      code: "auth_not_configured",
      title: "Auth Not Configured",
      type: "urn:lindorm:pylon:error:auth_not_configured",
      details:
        "Add `auth: { driver: new OpenIdDriver({ clientId, clientSecret }) }` to your Pylon options to use auth features, and register the upstream on the amphora (`idp`) — the driver reads its issuer from there.",
      data: { method },
    },
  );
};

export const createUnconfiguredAuthClient = (): PylonAuthClient => ({
  // Reading a property must never explode (a debug log that spreads `ctx.auth`
  // would), and `false` states the truth — an absent driver can do nothing.
  // Every METHOD still throws.
  capabilities: { introspect: false, userinfo: false },
  config: () => notConfigured("config"),
  introspect: () => notConfigured("introspect"),
  userinfo: () => notConfigured("userinfo"),
  login: () => notConfigured("login"),
  logout: () => notConfigured("logout"),
});
