import { OidcSession } from "../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../types";
import { configuration } from "../server/configuration";
import { find } from "lodash";
import { OpenIdClaims } from "@lindorm-io/common-types";

export const verifyOidcWithIdToken = async (
  ctx: ServerKoaContext,
  oidcSession: OidcSession,
  idToken: string,
): Promise<OpenIdClaims> => {
  const { jwt, logger } = ctx;

  logger.debug("Resolving OIDC with id token");

  const config = find(configuration.oidc_providers, { key: oidcSession.provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  const { client_id: clientId, token_issuer: issuer } = config;

  const { subject: sub, claims } = jwt.verify<never, Omit<OpenIdClaims, "sub">>(idToken, {
    audience: clientId,
    issuer,
    ...(oidcSession.nonce ? { nonce: oidcSession.nonce } : {}),
  });

  logger.debug("Claims", { sub, ...claims });

  return { sub, ...claims };
};
