import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { SessionStatus } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../../types";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { getOauthLogoutRedirect, getOauthLogoutSession } from "../../../handler";

interface RequestData {
  session: string;
}

export const redirectLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const redirectLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { session },
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
      query: { session },
    }),
  };
};
