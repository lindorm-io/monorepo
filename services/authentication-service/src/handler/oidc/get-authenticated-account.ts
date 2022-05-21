import { Account, LoginSession, OidcSession } from "../../entity";
import { OpenIDClaims } from "../../common";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { find } from "lodash";
import { findOrCreateAccount } from "../account";
import { identityAuthenticateOidc, identityUpdateUserinfo } from "../axios";

interface Options {
  subject: string;
  claims: Partial<OpenIDClaims>;
}

export const getAuthenticatedAccount = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  oidcSession: OidcSession,
  options: Options,
): Promise<Account> => {
  const { logger } = ctx;

  const { subject, claims } = options;

  const { base_url: baseUrl } =
    find(configuration.oidc_providers, { key: oidcSession.identityProvider }) || {};

  logger.debug("Authenticating identity");

  const { identityId } = await identityAuthenticateOidc(ctx, loginSession, {
    provider: baseUrl,
    subject: subject,
  });

  logger.debug("Updating user info");

  await identityUpdateUserinfo(ctx, identityId, {
    provider: baseUrl,
    sub: subject,
    ...claims,
  });

  return findOrCreateAccount(ctx, identityId);
};
