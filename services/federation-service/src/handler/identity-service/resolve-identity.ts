import {
  EnsureIdentityRequestParams,
  FindIdentityRequestQuery,
  FindIdentityResponse,
} from "@lindorm-io/common-types";
import { removeEmptyFromObject } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import { FederationSession } from "../../entity";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

type Options = {
  provider: string;
  subject: string;
};

export const resolveIdentity = async (
  ctx: ServerKoaContext,
  federationSession: FederationSession,
  options: Options,
): Promise<FederationSession> => {
  const {
    axios: { identityClient },
    redis: { federationSessionCache },
  } = ctx;

  // Identity already resolved

  if (federationSession.identityId) {
    return federationSession;
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
    middleware: [clientCredentialsMiddleware()],
  });

  if (data.identityId) {
    federationSession.identityId = data.identityId;

    return await federationSessionCache.update(federationSession);
  }

  // Create new identity

  const identityId = randomUUID();

  await identityClient.put<never, never, EnsureIdentityRequestParams>("/admin/identities/:id", {
    params: { id: identityId },
    middleware: [clientCredentialsMiddleware()],
  });

  federationSession.identityId = identityId;

  return await federationSessionCache.update(federationSession);
};
