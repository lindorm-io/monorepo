import { AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { SessionStatuses } from "@lindorm-io/common-types";
import { getUpdatedBrowserSession } from "../sessions";
import { setBrowserSessionCookie } from "../cookies";

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
  authorizationSession.status.login = SessionStatuses.VERIFIED;

  return await authorizationSessionCache.update(authorizationSession);
};
