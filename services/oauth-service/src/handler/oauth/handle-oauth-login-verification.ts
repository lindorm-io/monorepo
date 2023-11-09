import { SessionStatus } from "@lindorm-io/common-enums";
import { uniqArray } from "@lindorm-io/core";
import { AuthorizationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getBrowserSessionCookies, setBrowserSessionCookies } from "../cookies";
import { getUpdatedBrowserSession } from "../sessions";

export const handleOauthLoginVerification = async (
  ctx: ServerKoaContext,
  authorizationSession: AuthorizationSession,
): Promise<AuthorizationSession> => {
  const {
    redis: { authorizationSessionCache },
  } = ctx;

  const browserSession = await getUpdatedBrowserSession(ctx, authorizationSession);
  const cookies = getBrowserSessionCookies(ctx);

  setBrowserSessionCookies(ctx, uniqArray(cookies, browserSession.id));

  authorizationSession.browserSessionId = browserSession.id;
  authorizationSession.status.login = SessionStatus.VERIFIED;

  return await authorizationSessionCache.update(authorizationSession);
};
