import { ServerKoaContext } from "../../types";
import { AuthorizationSession } from "../../entity";
import { getUpdatedBrowserSession } from "../sessions";
import { setBrowserSessionCookie } from "../cookies";
import { SessionStatus } from "../../common";

export const handleOauthLoginVerification = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationSession> => {
  const {
    cache: { authorizationSessionCache },
  } = ctx;

  const browserSession = await getUpdatedBrowserSession(ctx, authorizationSession);
  setBrowserSessionCookie(ctx, browserSession);

  authorizationSession.identifiers.browserSessionId = browserSession.id;
  authorizationSession.status.login = SessionStatus.VERIFIED;

  return await authorizationSessionCache.update(authorizationSession);
};
