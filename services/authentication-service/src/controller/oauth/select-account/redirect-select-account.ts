import { SessionStatus } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { getOauthAuthorizationRedirect, getOauthAuthorizationSession } from "../../../handler";
import { configuration } from "../../../server/configuration";
import { ServerKoaController } from "../../../types";

type RequestData = {
  session: string;
};

export const redirectSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const redirectSelectAccountController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { session },
    logger,
  } = ctx;

  const {
    selectAccount: { status },
  } = await getOauthAuthorizationSession(ctx, session);

  if (status !== SessionStatus.PENDING) {
    logger.warn("Unexpected Session Status", { status });

    const { redirectTo } = await getOauthAuthorizationRedirect(ctx, session);

    return { redirect: redirectTo };
  }

  return {
    redirect: createURL(configuration.frontend.routes.select_account, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { session },
    }),
  };
};
