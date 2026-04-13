import { ServerError } from "@lindorm/errors";
import { PylonAuthClient } from "../../../types";

const notConfigured = (method: string): never => {
  throw new ServerError(
    `ctx.auth.${method}() called but options.auth is not configured`,
    {
      details:
        "Add `auth: { issuer, clientId, clientSecret, ... }` to your Pylon options to use auth features.",
    },
  );
};

export const createUnconfiguredAuthClient = (): PylonAuthClient => ({
  introspect: () => notConfigured("introspect"),
  userinfo: () => notConfigured("userinfo"),
  login: () => notConfigured("login"),
  logout: () => notConfigured("logout"),
  token: () => notConfigured("token"),
});
