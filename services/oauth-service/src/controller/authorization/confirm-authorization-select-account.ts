import { SessionStatus } from "@lindorm-io/common-enums";
import {
  ConfirmSelectAccountRequestBody,
  ConfirmSelectAccountRequestParams,
  ConfirmSelectAccountResponse,
  LindormIdentityClaims,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { BrowserSessionLike } from "../../entity";
import {
  isConsentRequired,
  isLoginRequired,
  isSsoAvailable,
  tryFindClientSession,
} from "../../handler";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createAuthorizationVerifyUri } from "../../util";

type RequestData = ConfirmSelectAccountRequestParams & ConfirmSelectAccountRequestBody;

type ResponseBody = ConfirmSelectAccountResponse;

export const confirmAuthorizationSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    selectExisting: Joi.string().guid(),
    selectNew: Joi.boolean(),
  })
  .required();

export const confirmAuthorizationSelectAccountController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationSessionCache },
    data: { selectExisting, selectNew },
    entity: { authorizationSession, client },
    jwt,
    logger,
    mongo: { browserSessionRepository },
  } = ctx;

  assertSessionPending(authorizationSession.status.selectAccount);

  logger.debug("Updating authorization session");

  if (selectNew) {
    authorizationSession.browserSessionId = null;
    authorizationSession.clientSessionId = null;
    authorizationSession.status.login = SessionStatus.PENDING;
    authorizationSession.status.consent = SessionStatus.PENDING;
  } else if (selectExisting) {
    if (
      !authorizationSession.requestedSelectAccount.browserSessions.find(
        (x: BrowserSessionLike) => x.browserSessionId === selectExisting,
      )
    ) {
      throw new ClientError("Invalid request", {
        description: "Invalid selected session",
      });
    }

    const browserSession = await browserSessionRepository.find({ id: selectExisting });
    authorizationSession.browserSessionId = browserSession.id;

    const idToken = authorizationSession.idTokenHint
      ? jwt.verify<LindormIdentityClaims>(authorizationSession.idTokenHint)
      : undefined;

    const clientSession = await tryFindClientSession(ctx, client, browserSession, idToken);
    const loginRequired = isLoginRequired(ctx, authorizationSession, browserSession, clientSession);
    const consentRequired = isConsentRequired(
      ctx,
      authorizationSession,
      browserSession,
      clientSession,
    );

    authorizationSession.clientSessionId = clientSession?.id || null;

    authorizationSession.status.login = loginRequired ? SessionStatus.PENDING : SessionStatus.SKIP;
    authorizationSession.status.consent = consentRequired
      ? SessionStatus.PENDING
      : SessionStatus.SKIP;

    if (
      loginRequired &&
      browserSession &&
      isSsoAvailable(ctx, authorizationSession, client, browserSession)
    ) {
      authorizationSession.confirmLogin(browserSession);
    }
  } else {
    throw new ClientError("Invalid input", {
      description: "Use one of the inputs [ selectExisting | selectNew ]",
      data: { selectExisting, selectNew },
    });
  }

  authorizationSession.status.selectAccount = SessionStatus.CONFIRMED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationSession) } };
};
