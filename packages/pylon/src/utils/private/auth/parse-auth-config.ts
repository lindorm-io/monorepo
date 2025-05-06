import { PkceMethod } from "@lindorm/enums";
import { merge } from "@lindorm/utils";
import { PylonAuthConfig, PylonAuthOptions } from "../../../types";

const DEFAULT: Omit<PylonAuthConfig, "clientId" | "clientSecret" | "issuer"> = {
  codeChallengeMethod: PkceMethod.S256,
  errorRedirect: "/error",
  pathPrefix: "/auth",
  tokenExpiry: "1d",

  defaults: {
    acrValues: null,
    audience: null,
    maxAge: null,
    prompt: null,
    responseType: "code",
    scope: ["openid", "offline_access", "email", "profile"],
  },

  dynamicRedirectDomains: [],

  expose: {
    accessToken: false,
    idToken: false,
    scope: false,
    subject: false,
  },

  cookies: {
    login: "pylon_login_session",
    logout: "pylon_logout_session",
  },

  refresh: {
    maxAge: "1h",
    mode: "half_life",
  },

  staticRedirect: {
    login: null,
    logout: null,
  },
};

export const parseAuthConfig = (options: PylonAuthOptions): PylonAuthConfig => {
  const merged = merge<PylonAuthConfig>(DEFAULT, options);

  merged.errorRedirect =
    options.errorRedirect ?? merged.pathPrefix + merged.errorRedirect;

  return merged;
};
