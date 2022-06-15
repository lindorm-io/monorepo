import Joi from "joi";
import { CONSENT_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { confirmOauthConsentSession } from "../../handler";
import { difference } from "lodash";

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

  const wrongAudiences = difference(audiences, consentSession.requestedAudiences);

  if (wrongAudiences.length) {
    throw new ClientError("Invalid Audiences", {
      description: "Unexpected audiences added",
      data: {
        expect: consentSession.requestedAudiences,
        actual: audiences,
        wrong: wrongAudiences,
      },
    });
  }

  const missingScopes = difference(consentSession.requiredScopes, scopes);

  if (missingScopes.length) {
    throw new ClientError("Invalid Scopes", {
      description: "Required scopes missing",
      data: {
        expect: consentSession.requiredScopes,
        actual: scopes,
        missing: missingScopes,
      },
    });
  }

  const wrongScopes = difference(scopes, consentSession.requestedScopes);

  if (wrongScopes.length) {
    throw new ClientError("Invalid Scopes", {
      description: "Unexpected scopes added",
      data: {
        expect: consentSession.requestedScopes,
        actual: scopes,
        wrong: wrongScopes,
      },
    });
  }

  const { redirectTo } = await confirmOauthConsentSession(ctx, consentSession.oauthSessionId, {
    audiences,
    scopes,
  });

  await consentSessionCache.destroy(consentSession);

  ctx.deleteCookie(CONSENT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
