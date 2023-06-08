import {
  GetAuthenticationTokenQuery,
  GetAuthenticationTokenResponse,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import {
  getOauthAuthenticationTokenSession,
  resolveAuthenticationConfirmationToken,
} from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = GetAuthenticationTokenQuery;

type ResponseData = GetAuthenticationTokenResponse;

export const resolveAuthenticationTokenGrantSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const resolveAuthenticationTokenGrantController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseData> => {
  const {
    data: { session },
  } = ctx;

  const {
    authenticationTokenSession: { token },
  } = await getOauthAuthenticationTokenSession(ctx, session);

  const authenticationConfirmationToken = await resolveAuthenticationConfirmationToken(ctx, token);

  if (session !== authenticationConfirmationToken.sessionId) {
    throw new ClientError("Invalid session identifier", {
      debug: {
        expect: session,
        actual: authenticationConfirmationToken.sessionId,
      },
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  return {
    body: {
      identityId: authenticationConfirmationToken.identityId,
      latestAuthentication: authenticationConfirmationToken.created.toISOString(),
      levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
      methods: authenticationConfirmationToken.methods,
      nonce: authenticationConfirmationToken.nonce,
    },
  };
};
