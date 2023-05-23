import {
  Environment,
  SessionStatus,
  VerifyAuthorizationRequestQuery,
} from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import {
  generateCallbackResponse,
  handleOauthConsentVerification,
  handleOauthLoginVerification,
} from "../../handler";
import { ServerKoaController } from "../../types";
import {
  createConsentPendingUri,
  createConsentRejectedUri,
  createLoginPendingUri,
  createLoginRejectedUri,
  createSelectAccountPendingUri,
  createSelectAccountRejectedUri,
} from "../../util";

type RequestData = VerifyAuthorizationRequestQuery;

export const verifyAuthorizationSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
    redirectUri: Joi.string().uri().required(),
  })
  .required();

export const verifyAuthorizationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { redirectUri },
    entity: { client },
    mongo: { clientSessionRepository },
  } = ctx;

  let authorizationRequest = ctx.entity.authorizationRequest;

  if (redirectUri !== authorizationRequest.redirectUri) {
    throw new ClientError("Invalid Redirect URI");
  }

  const cookieId = ctx.cookies.get(AUTHORIZATION_SESSION_COOKIE_NAME, {
    signed: ctx.server.environment !== Environment.TEST,
  });

  if (cookieId !== authorizationRequest.id) {
    throw new ClientError("Invalid Session ID", {
      description: "Mismatched cookie ID",
      debug: {
        expect: authorizationRequest.id,
        actual: cookieId,
      },
    });
  }

  switch (authorizationRequest.status.selectAccount) {
    case SessionStatus.CONFIRMED:
      break;

    case SessionStatus.PENDING:
      return { redirect: createSelectAccountPendingUri(authorizationRequest) };

    case SessionStatus.REJECTED:
      return { redirect: createSelectAccountRejectedUri(authorizationRequest) };

    case SessionStatus.SKIP:
      break;

    case SessionStatus.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { select: authorizationRequest.status.selectAccount },
      });
  }

  switch (authorizationRequest.status.login) {
    case SessionStatus.CONFIRMED:
      authorizationRequest = await handleOauthLoginVerification(ctx, authorizationRequest);
      break;

    case SessionStatus.PENDING:
      return { redirect: createLoginPendingUri(authorizationRequest) };

    case SessionStatus.REJECTED:
      return { redirect: createLoginRejectedUri(authorizationRequest) };

    case SessionStatus.SKIP:
      break;

    case SessionStatus.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { login: authorizationRequest.status.login },
      });
  }

  switch (authorizationRequest.status.consent) {
    case SessionStatus.CONFIRMED:
      authorizationRequest = await handleOauthConsentVerification(
        ctx,
        authorizationRequest,
        client,
      );
      break;

    case SessionStatus.PENDING:
      return { redirect: createConsentPendingUri(authorizationRequest) };

    case SessionStatus.REJECTED:
      return { redirect: createConsentRejectedUri(authorizationRequest) };

    case SessionStatus.SKIP:
      break;

    case SessionStatus.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { consent: authorizationRequest.status.consent },
      });
  }

  if (!authorizationRequest.browserSessionId || !authorizationRequest.clientSessionId) {
    throw new ServerError("Invalid session state", {
      debug: {
        browserSessionId: authorizationRequest.browserSessionId,
        clientSessionId: authorizationRequest.clientSessionId,
      },
    });
  }

  const clientSession = await clientSessionRepository.find({
    id: authorizationRequest.clientSessionId,
  });

  return await generateCallbackResponse(ctx, authorizationRequest, client, clientSession);
};
