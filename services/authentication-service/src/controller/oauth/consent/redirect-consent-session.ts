import { OpenIdClientType, OpenIdDisplayMode, SessionStatus } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import {
  confirmOauthConsent,
  getOauthAuthorizationRedirect,
  getOauthAuthorizationSession,
} from "../../../handler";
import { configuration } from "../../../server/configuration";
import { ServerKoaController } from "../../../types";

type RequestData = {
  display: OpenIdDisplayMode;
  locales: string;
  session: string;
};

export const redirectConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    display: Joi.string()
      .valid(...Object.values(OpenIdDisplayMode))
      .required(),
    locales: Joi.string().required(),
    session: Joi.string().guid().required(),
  })
  .required();

export const redirectConsentSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { display, locales, session },
    logger,
  } = ctx;

  const {
    consent: { status, audiences, optionalScopes, requiredScopes },
    client: { type },
  } = await getOauthAuthorizationSession(ctx, session);

  if (status !== SessionStatus.PENDING) {
    logger.warn("Unexpected Session Status", { status });

    const { redirectTo } = await getOauthAuthorizationRedirect(ctx, session);

    return { redirect: redirectTo };
  }

  if (type === OpenIdClientType.CONFIDENTIAL) {
    const { redirectTo } = await confirmOauthConsent(ctx, session, {
      audiences,
      scopes: [...optionalScopes, ...requiredScopes],
    });

    return { redirect: redirectTo };
  }

  return {
    redirect: createURL(configuration.frontend.routes.consent, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { display, locales, session },
    }),
  };
};
