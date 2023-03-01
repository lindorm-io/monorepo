import Joi from "joi";
import { AuthenticationConfirmationTokenClaims } from "../../../common";
import { AuthenticationTokenType, SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import {
  confirmOauthLogin,
  getOauthAuthorizationRedirect,
  getOauthAuthorizationSession,
} from "../../../handler";

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
    jwt,
    logger,
  } = ctx;

  const {
    login: { status },
    authorizationSession: { authToken },
  } = await getOauthAuthorizationSession(ctx, session);

  if (status !== SessionStatus.PENDING) {
    logger.warn("Unexpected Session Status", { status });

    const { redirectTo } = await getOauthAuthorizationRedirect(ctx, session);

    return { redirect: redirectTo };
  }

  if (authToken) {
    try {
      const authenticationConfirmationToken = jwt.verify<
        never,
        AuthenticationConfirmationTokenClaims
      >(authToken, {
        issuer: configuration.server.issuer,
        types: [AuthenticationTokenType.AUTHENTICATION_CONFIRMATION],
      });

      if (session !== authenticationConfirmationToken.session) {
        throw new ClientError("Invalid session identifier", {
          debug: {
            expect: session,
            actual: authenticationConfirmationToken.session,
          },
          statusCode: ClientError.StatusCode.FORBIDDEN,
        });
      }

      const { redirectTo } = await confirmOauthLogin(ctx, authenticationConfirmationToken);

      return { redirect: redirectTo };
    } catch (err: any) {
      logger.warn("Invalid auth token", { authToken });
    }
  }

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { session },
    }),
  };
};
