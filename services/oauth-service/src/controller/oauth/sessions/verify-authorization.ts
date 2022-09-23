import Joi from "joi";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse, Environment } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../../common";
import { ServerKoaController } from "../../../types";
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

type RequestData = {
  redirectUri: string;
  sessionId: string;
};

export const verifyAuthorizationSchema = Joi.object<RequestData>()
  .keys({
    redirectUri: Joi.string().uri().required(),
    sessionId: JOI_GUID.required(),
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
    signed: ctx.metadata.environment !== Environment.TEST,
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
      throw new ClientError("Unexpected session status");
  }

  switch (authorizationSession.status.consent) {
    case SessionStatus.CONFIRMED:
      authorizationSession = await handleOauthConsentVerification(ctx, authorizationSession);
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
