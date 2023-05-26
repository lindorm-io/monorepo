import { SessionStatus } from "@lindorm-io/common-types";
import { AuthorizationSession, Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getUpdatedClientSession } from "../sessions";

export const handleOauthConsentVerification = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
  client: Client,
): Promise<AuthorizationSession> => {
  const {
    redis: { authorizationSessionCache },
  } = ctx;

  const clientSession = await getUpdatedClientSession(ctx, authorizationSession, client);

  authorizationSession.clientSessionId = clientSession.id;
  authorizationSession.status.consent = SessionStatus.VERIFIED;

  return await authorizationSessionCache.update(authorizationSession);
};
