import { SessionStatus } from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { AuthorizationRequest } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getBrowserSessionCookies, setBrowserSessionCookies } from "../cookies";
import { getUpdatedBrowserSession } from "../sessions";

export const handleOauthLoginVerification = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
): Promise<AuthorizationRequest> => {
  const {
    redis: { authorizationRequestCache },
  } = ctx;

  const browserSession = await getUpdatedBrowserSession(ctx, authorizationRequest);
  const cookies = getBrowserSessionCookies(ctx);

  setBrowserSessionCookies(ctx, uniqArray(cookies, browserSession.id));

  authorizationRequest.browserSessionId = browserSession.id;
  authorizationRequest.status.login = SessionStatus.VERIFIED;

  return await authorizationRequestCache.update(authorizationRequest);
};
