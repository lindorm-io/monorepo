import Joi from "joi";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import {
  Environments,
  SessionStatuses,
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
    signed: ctx.server.environment !== Environments.TEST,
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
    case SessionStatuses.CONFIRMED:
      break;

    case SessionStatuses.PENDING:
      return { redirect: createSelectAccountPendingUri(authorizationSession) };

    case SessionStatuses.REJECTED:
      return { redirect: createSelectAccountRejectedUri(authorizationSession) };

    case SessionStatuses.SKIP:
      break;

    case SessionStatuses.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { select: authorizationSession.status.selectAccount },
      });
  }

  switch (authorizationSession.status.login) {
    case SessionStatuses.CONFIRMED:
      authorizationSession = await handleOauthLoginVerification(ctx, authorizationSession);
      break;

    case SessionStatuses.PENDING:
      return { redirect: createLoginPendingUri(authorizationSession) };

    case SessionStatuses.REJECTED:
      return { redirect: createLoginRejectedUri(authorizationSession) };

    case SessionStatuses.SKIP:
      break;

    case SessionStatuses.VERIFIED:
      break;

    default:
      throw new ServerError("Unexpected session status", {
        debug: { login: authorizationSession.status.login },
      });
  }

  switch (authorizationSession.status.consent) {
    case SessionStatuses.CONFIRMED:
      authorizationSession = await handleOauthConsentVerification(
        ctx,
        authorizationSession,
        client,
      );
      break;

    case SessionStatuses.PENDING:
      return { redirect: createConsentPendingUri(authorizationSession) };

    case SessionStatuses.REJECTED:
      return { redirect: createConsentRejectedUri(authorizationSession) };

    case SessionStatuses.SKIP:
      break;

    case SessionStatuses.VERIFIED:
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
