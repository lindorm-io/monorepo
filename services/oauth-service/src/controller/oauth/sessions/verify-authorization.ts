import Joi from "joi";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import {
  Environments,
  SessionStatuses,
  VerifyAuthorizationRequestQuery,
} from "@lindorm-io/common-types";
import {
  generateCallbackResponse,
  handleOauthConsentVerification,
  handleOauthLoginVerification,
} from "../../../handler";
import {
  createConsentPendingUri,
  createConsentRejectedUri,
  createLoginPendingUri,
  createLoginRejectedUri,
} from "../../../util";

type RequestData = VerifyAuthorizationRequestQuery;

export const verifyAuthorizationSchema = Joi.object<RequestData>()
  .keys({
    redirectUri: Joi.string().uri().required(),
    sessionId: Joi.string().guid().required(),
  })
  .required();

export const verifyAuthorizationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { redirectUri },
    entity: { client },
    repository: { browserSessionRepository, consentSessionRepository },
  } = ctx;

  let authorizationSession = ctx.entity.authorizationSession;

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

  if (redirectUri !== authorizationSession.redirectUri) {
    throw new ClientError("Invalid Redirect URI");
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
      throw new ClientError("Unexpected session status");
  }

  switch (authorizationSession.status.consent) {
    case SessionStatuses.CONFIRMED:
      authorizationSession = await handleOauthConsentVerification(ctx, authorizationSession);
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
      throw new ClientError("Unexpected session status");
  }

  const {
    identifiers: { browserSessionId, consentSessionId },
  } = authorizationSession;

  const browserSession = await browserSessionRepository.find({ id: browserSessionId });
  const consentSession = await consentSessionRepository.find({ id: consentSessionId });

  return await generateCallbackResponse(
    ctx,
    authorizationSession,
    browserSession,
    consentSession,
    client,
  );
};
