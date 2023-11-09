import { OpenIdDisplayMode, SessionStatus } from "@lindorm-io/common-enums";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { getOauthLogoutRedirect, getOauthLogoutSession } from "../../../handler";
import { configuration } from "../../../server/configuration";
import { ServerKoaController } from "../../../types";

interface RequestData {
  display: OpenIdDisplayMode;
  locales: string;
  session: string;
}

export const redirectLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    display: Joi.string()
      .valid(...Object.values(OpenIdDisplayMode))
      .required(),
    locales: Joi.string().required(),
    session: Joi.string().guid().required(),
  })
  .required();

export const redirectLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { display, locales, session },
    logger,
  } = ctx;

  const {
    logout: { status },
  } = await getOauthLogoutSession(ctx, session);

  if (status !== SessionStatus.PENDING) {
    logger.warn("Unexpected Session Status", { status });

    const { redirectTo } = await getOauthLogoutRedirect(ctx, session);

    return { redirect: redirectTo };
  }

  return {
    redirect: createURL(configuration.frontend.routes.logout, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { display, locales, session },
    }),
  };
};
