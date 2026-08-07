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

/**
 * ⚠ Every member THROWS, and that is now the whole of it: `ctx.auth` is verbs
 * only, so there is no property here a debug log could explode on. What a
 * handler needs to KNOW — that no auth is configured — is
 * `ctx.state.app.config.auth === null`, which is a plain read.
 */
export const createUnconfiguredAuthClient = (): PylonAuthClient => ({
  introspect: () => notConfigured("introspect"),
  userinfo: () => notConfigured("userinfo"),
  login: () => notConfigured("login"),
  logout: () => notConfigured("logout"),
});
