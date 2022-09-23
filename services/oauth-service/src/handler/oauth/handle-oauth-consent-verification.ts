import { AuthorizationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { SessionStatus } from "../../common";
import { getUpdatedConsentSession } from "../sessions";

export const handleOauthConsentVerification = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationSession> => {
  const {
    cache: { authorizationSessionCache },
    repository: { browserSessionRepository },
  } = ctx;

  if (!authorizationSession.identifiers.browserSessionId) {
    throw new ServerError("Invalid session state", {
      description: "Expected to find Browser Session",
    });
  }

  const browserSession = await browserSessionRepository.find({
    id: authorizationSession.identifiers.browserSessionId,
  });

  const consentSession = await getUpdatedConsentSession(ctx, authorizationSession, browserSession);

  authorizationSession.identifiers.consentSessionId = consentSession.id;
  authorizationSession.status.consent = SessionStatus.VERIFIED;

  return await authorizationSessionCache.update(authorizationSession);
};
