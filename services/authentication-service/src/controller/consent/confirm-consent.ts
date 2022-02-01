import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { oauthConfirmConsent } from "../../handler";
import { CONSENT_SESSION_COOKIE_NAME } from "../../constant";

interface RequestData {
  audiences: Array<string>;
  scopes: Array<string>;
}

export const confirmConsentSchema = Joi.object<RequestData>({
  audiences: Joi.array().items(Joi.string().lowercase()),
  scopes: Joi.array().items(Joi.string().lowercase()),
});

export const confirmConsentController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { consentSessionCache },
    data: { audiences, scopes },
    entity: { consentSession },
  } = ctx;

  const { redirectTo } = await oauthConfirmConsent(ctx, {
    sessionId: consentSession.oauthSessionId,
    audiences,
    scopes,
  });

  await consentSessionCache.destroy(consentSession);

  ctx.deleteCookie(CONSENT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
