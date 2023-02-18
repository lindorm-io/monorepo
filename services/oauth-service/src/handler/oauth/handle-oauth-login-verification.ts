import { AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { SessionStatuses } from "@lindorm-io/common-types";
import { getBrowserSessionCookies, setBrowserSessionCookies } from "../cookies";
import { getUpdatedBrowserSession } from "../sessions";
import { uniqArray } from "@lindorm-io/core";

export const handleOauthLoginVerification = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationSession> => {
  const {
    cache: { authorizationSessionCache },
  } = ctx;

  const browserSession = await getUpdatedBrowserSession(ctx, authorizationSession);
  const cookies = getBrowserSessionCookies(ctx);

  setBrowserSessionCookies(ctx, uniqArray(cookies, browserSession.id));

  authorizationSession.browserSessionId = browserSession.id;
  authorizationSession.status.login = SessionStatuses.VERIFIED;

  return await authorizationSessionCache.update(authorizationSession);
};
