import { SessionStatus } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { getOauthAuthorizationRedirect, getOauthAuthorizationSession } from "../../../handler";
import { configuration } from "../../../server/configuration";
import { ServerKoaController } from "../../../types";

interface RequestData {
  session: string;
}

export const redirectLoginSessionSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const redirectLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { session },
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

  // if (authToken) {
  //   try {
  //     const authenticationConfirmationToken = await resolveAuthenticationConfirmationToken(
  //       ctx,
  //       authToken,
  //     );

  //     if (session !== authenticationConfirmationToken.sessionId) {
  //       throw new ClientError("Invalid session identifier", {
  //         debug: {
  //           expect: session,
  //           actual: authenticationConfirmationToken.sessionId,
  //         },
  //         statusCode: ClientError.StatusCode.FORBIDDEN,
  //       });
  //     }

  //     const { redirectTo } = await confirmOauthLogin(ctx, authenticationConfirmationToken);

  //     return { redirect: redirectTo };
  //   } catch (err: any) {
  //     logger.warn("Invalid auth token", { authToken });
  //   }
  // }

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { session },
    }),
  };
};
