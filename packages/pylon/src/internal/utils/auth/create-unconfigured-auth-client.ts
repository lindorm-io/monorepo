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
        "Add `auth: { issuer, clientId, clientSecret, ... }` to your Pylon options to use auth features.",
      data: { method },
    },
  );
};

export const createUnconfiguredAuthClient = (): PylonAuthClient => ({
  // `null`, not a throwing getter: reading a property must never explode (a
  // debug log that spreads `ctx.auth` would), and `null` states the truth — there
  // is no configured client identity. Every METHOD still throws.
  config: null,
  introspect: () => notConfigured("introspect"),
  userinfo: () => notConfigured("userinfo"),
  login: () => notConfigured("login"),
  logout: () => notConfigured("logout"),
  token: () => notConfigured("token"),
});
