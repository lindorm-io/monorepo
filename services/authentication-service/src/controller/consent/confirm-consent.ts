import Joi from "joi";
import { CONSENT_SESSION_COOKIE_NAME } from "../../constant";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { confirmOauthConsentSession } from "../../handler";

interface RequestData {
  audiences: Array<string>;
  scopes: Array<string>;
}

export const confirmConsentSchema = Joi.object<RequestData>({
  audiences: Joi.array().items(Joi.string().lowercase()),
  scopes: Joi.array().items(Joi.string().lowercase()),
});

export const confirmConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { consentSessionCache },
    data: { audiences, scopes },
    entity: { consentSession },
  } = ctx;

  const { redirectTo } = await confirmOauthConsentSession(ctx, consentSession.oauthSessionId, {
    audiences,
    scopes,
  });

  await consentSessionCache.destroy(consentSession);

  ctx.deleteCookie(CONSENT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
