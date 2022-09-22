import Joi from "joi";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse, Environment } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../../common";
import { ServerKoaController } from "../../../types";
import {
  generateCallbackResponse,
  getUpdatedBrowserSession,
  getUpdatedConsentSession,
  setBrowserSessionCookie,
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
    cache: { authorizationSessionCache },
    data: { redirectUri },
    entity: { authorizationSession, client },
  } = ctx;

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
    case SessionStatus.SKIP:
      break;

    case SessionStatus.PENDING:
      return { redirect: createLoginPendingUri(authorizationSession) };

    case SessionStatus.REJECTED:
      return { redirect: createLoginRejectedUri(authorizationSession) };

    default:
      throw new ClientError("Unexpected session status");
  }

  switch (authorizationSession.status.consent) {
    case SessionStatus.CONFIRMED:
    case SessionStatus.SKIP:
      break;

    case SessionStatus.PENDING:
      return { redirect: createConsentPendingUri(authorizationSession) };

    case SessionStatus.REJECTED:
      return { redirect: createConsentRejectedUri(authorizationSession) };

    default:
      throw new ClientError("Unexpected session status");
  }

  const browserSession = await getUpdatedBrowserSession(ctx, authorizationSession);
  const consentSession = await getUpdatedConsentSession(ctx, authorizationSession, browserSession);

  setBrowserSessionCookie(ctx, browserSession);

  authorizationSession.identifiers.browserSessionId = browserSession.id;
  authorizationSession.identifiers.consentSessionId = consentSession.id;

  const updatedSession = await authorizationSessionCache.update(authorizationSession);

  return await generateCallbackResponse(
    ctx,
    updatedSession,
    browserSession,
    consentSession,
    client,
  );
};
