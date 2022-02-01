import { Account, LoginSession, OidcSession } from "../../entity";
import { Context } from "../../types";
import { configuration } from "../../configuration";
import { find } from "lodash";
import { getAuthenticatedAccount } from "./get-authenticated-account";

export const verifyOidcWithIdToken = async (
  ctx: Context,
  loginSession: LoginSession,
  oidcSession: OidcSession,
  idToken: string,
): Promise<Account> => {
  const { logger, jwt } = ctx;

  logger.debug("Resolving token with id token");

  const { client_id: clientId, token_issuer: issuer } =
    find(configuration.oidc_providers, { key: oidcSession.identityProvider }) || {};

  const { subject, claims } = jwt.verify(idToken, {
    audience: clientId,
    issuer,
    nonce: oidcSession.nonce,
  });

  return await getAuthenticatedAccount(ctx, loginSession, oidcSession, {
    subject,
    claims,
  });
};
