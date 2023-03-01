import { AuthenticationSession, StrategySession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { randomUUID } from "crypto";
import { removeEmptyFromObject } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import {
  EnsureIdentityRequestParams,
  FindIdentityRequestQuery,
  FindIdentityResponse,
  IdentifierType,
} from "@lindorm-io/common-types";

export const resolveIdentity = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
): Promise<AuthenticationSession> => {
  const {
    axios: { identityClient },
    cache: { authenticationSessionCache },
  } = ctx;

  // Identity already resolved

  if (authenticationSession.identityId) {
    return authenticationSession;
  }

  // Find existing identity

  const { identifier, identifierType } = strategySession;

  if (!identifier || !identifierType) {
    throw new ServerError("Invalid strategy session", {
      description: "Attributes are required",
      debug: { identifier, identifierType },
    });
  }

  const { data } = await identityClient.get<
    FindIdentityResponse,
    never,
    never,
    FindIdentityRequestQuery
  >("/admin/find", {
    query: removeEmptyFromObject<FindIdentityRequestQuery, FindIdentityRequestQuery>({
      email: identifierType === IdentifierType.EMAIL ? identifier : undefined,
      nin: identifierType === IdentifierType.NIN ? identifier : undefined,
      phone: identifierType === IdentifierType.PHONE ? identifier : undefined,
      username: identifierType === IdentifierType.USERNAME ? identifier : undefined,
    }),
    middleware: [clientCredentialsMiddleware()],
  });

  if (data.identityId) {
    authenticationSession.identityId = data.identityId;

    return await authenticationSessionCache.update(authenticationSession);
  }

  // Create new identity

  const identityId = randomUUID();

  await identityClient.put<never, never, EnsureIdentityRequestParams>("/admin/identities/:id", {
    params: { id: identityId },
    middleware: [clientCredentialsMiddleware()],
  });

  authenticationSession.identityId = identityId;

  return await authenticationSessionCache.update(authenticationSession);
};
