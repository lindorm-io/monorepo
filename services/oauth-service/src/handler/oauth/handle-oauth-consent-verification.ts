import { AuthorizationSession, Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import { LindormScopes, SessionStatuses } from "@lindorm-io/common-types";
import { getUpdatedAccessSession, getUpdatedRefreshSession } from "../sessions";

export const handleOauthConsentVerification = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
): Promise<AuthorizationSession> => {
  const {
    cache: { authorizationSessionCache },
  } = ctx;

  if (authorizationSession.confirmedConsent.scopes.includes(LindormScopes.OFFLINE_ACCESS)) {
    const refreshSession = await getUpdatedRefreshSession(ctx, authorizationSession, client);

    authorizationSession.accessSessionId = null;
    authorizationSession.refreshSessionId = refreshSession.id;
  } else {
    const accessSession = await getUpdatedAccessSession(ctx, authorizationSession);

    authorizationSession.accessSessionId = accessSession.id;
    authorizationSession.refreshSessionId = null;
  }

  authorizationSession.status.consent = SessionStatuses.VERIFIED;

  return await authorizationSessionCache.update(authorizationSession);
};
