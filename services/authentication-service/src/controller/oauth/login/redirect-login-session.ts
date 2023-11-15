import { TransformMode } from "@lindorm-io/axios";
import { OpenIdDisplayMode, SessionStatus } from "@lindorm-io/common-enums";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { getOauthAuthorizationRedirect, getOauthAuthorizationSession } from "../../../handler";
import { configuration } from "../../../server/configuration";
import { ServerKoaController } from "../../../types";

interface RequestData {
  display: OpenIdDisplayMode;
  locales: string;
  session: string;
}

export const redirectLoginSessionSchema = Joi.object<RequestData>()
  .keys({
    display: Joi.string()
      .valid(...Object.values(OpenIdDisplayMode))
      .required(),
    locales: Joi.string().required(),
    session: Joi.string().guid().required(),
  })
  .required();

export const redirectLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { display, locales, session },
    logger,
  } = ctx;

  const {
    login: { status },
  } = await getOauthAuthorizationSession(ctx, session);

  if (status !== SessionStatus.PENDING) {
    logger.warn("Unexpected Session Status", { status });

    const { redirectTo } = await getOauthAuthorizationRedirect(ctx, session);

    return { redirect: redirectTo };
  }

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: {
        display,
        locales,
        session,
      },
      queryCaseTransform: TransformMode.SNAKE,
    }),
  };
};
