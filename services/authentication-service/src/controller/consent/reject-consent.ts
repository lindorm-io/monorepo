import { CONSENT_SESSION_COOKIE_NAME } from "../../constant";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { oauthRejectConsent } from "../../handler";

export const rejectConsentController: Controller<Context> = async (ctx): ControllerResponse => {
  const {
    cache: { consentSessionCache },
    entity: { consentSession },
  } = ctx;

  const { redirectTo } = await oauthRejectConsent(ctx, consentSession.oauthSessionId);

  await consentSessionCache.destroy(consentSession);

  ctx.deleteCookie(CONSENT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
