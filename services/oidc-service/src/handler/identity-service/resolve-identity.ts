import { OidcSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { randomUUID } from "crypto";
import { removeEmptyFromObject } from "@lindorm-io/core";
import {
  EnsureIdentityRequestParams,
  FindIdentityRequestQuery,
  FindIdentityResponse,
} from "@lindorm-io/common-types";

type Options = {
  provider: string;
  subject: string;
};

export const resolveIdentity = async (
  ctx: ServerKoaContext,
  oidcSession: OidcSession,
  options: Options,
): Promise<OidcSession> => {
  const {
    axios: { identityClient, oauthClient },
    cache: { oidcSessionCache },
  } = ctx;

  // Identity already resolved

  if (oidcSession.identityId) {
    return oidcSession;
  }

  // Find existing identity

  const { provider, subject } = options;

  const { data } = await identityClient.get<
    FindIdentityResponse,
    never,
    never,
    FindIdentityRequestQuery
  >("/admin/find", {
    query: removeEmptyFromObject<FindIdentityRequestQuery, FindIdentityRequestQuery>({
      external: subject,
      provider,
    }),
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  if (data.identityId) {
    oidcSession.identityId = data.identityId;

    return await oidcSessionCache.update(oidcSession);
  }

  // Create new identity

  const identityId = randomUUID();

  await identityClient.put<never, never, EnsureIdentityRequestParams>("/admin/identities/:id", {
    params: { id: identityId },
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  oidcSession.identityId = identityId;

  return await oidcSessionCache.update(oidcSession);
};
