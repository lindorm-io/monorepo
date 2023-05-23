import {
  ConfirmSelectAccountRequestBody,
  ConfirmSelectAccountRequestParams,
  ConfirmSelectAccountResponse,
  LindormClaims,
  SessionStatus,
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

export const confirmSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    selectExisting: Joi.string().guid(),
    selectNew: Joi.boolean(),
  })
  .required();

export const confirmSelectAccountController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationRequestCache },
    data: { selectExisting, selectNew },
    entity: { authorizationRequest, client },
    jwt,
    logger,
    mongo: { browserSessionRepository },
  } = ctx;

  assertSessionPending(authorizationRequest.status.selectAccount);

  logger.debug("Updating authorization session");

  if (selectNew) {
    authorizationRequest.browserSessionId = null;
    authorizationRequest.clientSessionId = null;
    authorizationRequest.status.login = SessionStatus.PENDING;
    authorizationRequest.status.consent = SessionStatus.PENDING;
  } else if (selectExisting) {
    if (
      !authorizationRequest.requestedSelectAccount.browserSessions.find(
        (x: BrowserSessionLike) => x.browserSessionId === selectExisting,
      )
    ) {
      throw new ClientError("Invalid request", {
        description: "Invalid selected session",
      });
    }

    const browserSession = await browserSessionRepository.find({ id: selectExisting });
    authorizationRequest.browserSessionId = browserSession.id;

    const idToken = authorizationRequest.idTokenHint
      ? jwt.verify<LindormClaims>(authorizationRequest.idTokenHint)
      : undefined;

    const clientSession = await tryFindClientSession(ctx, client, browserSession, idToken);
    const loginRequired = isLoginRequired(ctx, authorizationRequest, browserSession, clientSession);
    const consentRequired = isConsentRequired(
      ctx,
      authorizationRequest,
      browserSession,
      clientSession,
    );

    authorizationRequest.clientSessionId = clientSession?.id || null;

    authorizationRequest.status.login = loginRequired ? SessionStatus.PENDING : SessionStatus.SKIP;
    authorizationRequest.status.consent = consentRequired
      ? SessionStatus.PENDING
      : SessionStatus.SKIP;

    if (
      loginRequired &&
      browserSession &&
      isSsoAvailable(ctx, authorizationRequest, client, browserSession)
    ) {
      authorizationRequest.confirmLogin(browserSession);
    }
  } else {
    throw new ClientError("Invalid input", {
      description: "Use one of the inputs [ selectExisting | selectNew ]",
      data: { selectExisting, selectNew },
    });
  }

  authorizationRequest.status.selectAccount = SessionStatus.CONFIRMED;

  await authorizationRequestCache.update(authorizationRequest);

  return { body: { redirectTo: createAuthorizationVerifyUri(authorizationRequest) } };
};
