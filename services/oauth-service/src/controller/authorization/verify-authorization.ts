import Joi from "joi";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import {
  Environment,
  SessionStatus,
  VerifyAuthorizationRequestQuery,
} from "@lindorm-io/common-types";
import {
  generateCallbackResponse,
  handleOauthConsentVerification,
  handleOauthLoginVerification,
} from "../../handler";
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
    redirectUri: Joi.string().uri().required(),
    session: Joi.string().guid().required(),
  })
  .required();

export const verifyAuthorizationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { redirectUri },
    entity: { client },
    repository: { accessSessionRepository, refreshSessionRepository },
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
    case SessionStatus.CONFIRMED:
      break;

    case SessionStatus.PENDING:
      return { redirect: createSelectAccountPendingUri(authorizationSession) };

    case SessionStatus.REJECTED:
      return { redirect: createSelectAccountRejectedUri(authorizationSession) };

    case SessionStatus.SKIP:
      break;

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
      return { redirect: createLoginRejectedUri(authorizationSession) };

    case SessionStatus.SKIP:
      break;

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
      return { redirect: createConsentRejectedUri(authorizationSession) };

    case SessionStatus.SKIP:
      break;

    case SessionStatus.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { consent: authorizationSession.status.consent },
      });
  }

  if (authorizationSession.refreshSessionId) {
    const refreshSession = await refreshSessionRepository.find({
      id: authorizationSession.refreshSessionId,
    });

    return await generateCallbackResponse(ctx, authorizationSession, client, refreshSession);
  }

  if (!authorizationSession.accessSessionId) {
    throw new ServerError("Invalid session state", {
      debug: { accessSessionId: authorizationSession.accessSessionId },
    });
  }

  const accessSession = await accessSessionRepository.find({
    id: authorizationSession.accessSessionId,
  });

  return await generateCallbackResponse(ctx, authorizationSession, client, accessSession);
};
