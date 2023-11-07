import { OpenIdClaims } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { find } from "lodash";
import { FederationSession } from "../entity";
import { configuration } from "../server/configuration";
import { ServerKoaContext } from "../types";

export const verifyFederationWithIdToken = async (
  ctx: ServerKoaContext,
  federationSession: FederationSession,
  idToken: string,
): Promise<OpenIdClaims> => {
  const { jwt, logger } = ctx;

  logger.debug("Resolving OIDC with id token");

  const config = find(configuration.federation_providers, { key: federationSession.provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  const { client_id: clientId, token_issuer: issuer } = config;

  const { claims, subject: sub } = jwt.verify<Omit<OpenIdClaims, "sub">>(idToken, {
    audience: clientId,
    issuer,
    ...(federationSession.nonce ? { nonce: federationSession.nonce } : {}),
  });

  logger.debug("Claims", { sub, ...claims });

  return { sub, ...claims };
};
