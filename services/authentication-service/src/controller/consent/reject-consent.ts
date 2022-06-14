import { CONSENT_SESSION_COOKIE_NAME } from "../../constant";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { rejectOauthConsentSession } from "../../handler";

export const rejectConsentController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    cache: { consentSessionCache },
    entity: { consentSession },
  } = ctx;

  const { redirectTo } = await rejectOauthConsentSession(ctx, consentSession.oauthSessionId);

  await consentSessionCache.destroy(consentSession);

  ctx.deleteCookie(CONSENT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
