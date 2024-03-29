import { Environment, SessionStatus } from "@lindorm-io/common-enums";
import { VerifyAuthorizationRequestQuery } from "@lindorm-io/common-types";
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
  createAuthorizationRejectedUri,
  createConsentPendingUri,
  createLoginPendingUri,
  createSelectAccountPendingUri,
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

  let authorizationSession = ctx.entity.authorizationSession;

  if (redirectUri !== authorizationSession.redirectUri) {
    throw new ClientError("Invalid Redirect URI");
  }

  const cookieId = ctx.cookies.get(AUTHORIZATION_SESSION_COOKIE_NAME, {
    signed: ctx.server.environment !== Environment.TEST,
  });

  if (cookieId !== authorizationSession.id) {
    throw new ClientError("Invalid Session ID", {
      description: "Mismatched cookie ID",
      debug: {
        expect: authorizationSession.id,
        actual: cookieId,
      },
    });
  }

  switch (authorizationSession.status.selectAccount) {
    case SessionStatus.PENDING:
      return { redirect: createSelectAccountPendingUri(authorizationSession) };

    case SessionStatus.REJECTED:
      return { redirect: createAuthorizationRejectedUri(authorizationSession) };

    case SessionStatus.CONFIRMED:
    case SessionStatus.SKIP:
    case SessionStatus.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { select: authorizationSession.status.selectAccount },
      });
  }

  switch (authorizationSession.status.login) {
    case SessionStatus.CONFIRMED:
      authorizationSession = await handleOauthLoginVerification(ctx, authorizationSession);
      break;

    case SessionStatus.PENDING:
      return { redirect: createLoginPendingUri(authorizationSession) };

    case SessionStatus.REJECTED:
      return { redirect: createAuthorizationRejectedUri(authorizationSession) };

    case SessionStatus.SKIP:
    case SessionStatus.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { login: authorizationSession.status.login },
      });
  }

  switch (authorizationSession.status.consent) {
    case SessionStatus.CONFIRMED:
      authorizationSession = await handleOauthConsentVerification(
        ctx,
        authorizationSession,
        client,
      );
      break;

    case SessionStatus.PENDING:
      return { redirect: createConsentPendingUri(authorizationSession) };

    case SessionStatus.REJECTED:
      return { redirect: createAuthorizationRejectedUri(authorizationSession) };

    case SessionStatus.SKIP:
    case SessionStatus.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { consent: authorizationSession.status.consent },
      });
  }

  if (!authorizationSession.browserSessionId || !authorizationSession.clientSessionId) {
    throw new ServerError("Invalid session state", {
      debug: {
        browserSessionId: authorizationSession.browserSessionId,
        clientSessionId: authorizationSession.clientSessionId,
      },
    });
  }

  const clientSession = await clientSessionRepository.find({
    id: authorizationSession.clientSessionId,
  });

  return await generateCallbackResponse(ctx, authorizationSession, client, clientSession);
};
