import Joi from "joi";
import { BrowserSessionLike } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { tryFindAccessSession, tryFindRefreshSession } from "../../handler";
import {
  assertSessionPending,
  createAuthorizationVerifyUri,
  isConsentRequired,
  isLoginRequired,
} from "../../util";
import {
  ConfirmSelectAccountRequestBody,
  ConfirmSelectAccountRequestParams,
  ConfirmSelectAccountResponse,
  LindormClaims,
  SessionStatus,
} from "@lindorm-io/common-types";

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
    cache: { authorizationSessionCache },
    data: { selectExisting, selectNew },
    entity: { authorizationSession, client },
    jwt,
    logger,
    repository: { browserSessionRepository },
  } = ctx;

  assertSessionPending(authorizationSession.status.selectAccount);

  logger.debug("Updating authorization session");

  if (selectNew) {
    authorizationSession.accessSessionId = null;
    authorizationSession.browserSessionId = null;
    authorizationSession.refreshSessionId = null;

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
      ? jwt.verify<never, LindormClaims>(authorizationSession.idTokenHint)
      : undefined;

    const accessSession = await tryFindAccessSession(ctx, client, browserSession, idToken);
    authorizationSession.accessSessionId = accessSession?.id || null;

    const refreshSession = await tryFindRefreshSession(ctx, client, browserSession, idToken);
    authorizationSession.refreshSessionId = refreshSession?.id || null;

    const loginRequired = isLoginRequired(
      authorizationSession,
      browserSession,
      accessSession,
      refreshSession,
    );

    authorizationSession.status.login = loginRequired ? SessionStatus.PENDING : SessionStatus.SKIP;

    const consentRequired = isConsentRequired(
      authorizationSession,
      browserSession,
      accessSession,
      refreshSession,
    );

    authorizationSession.status.consent = consentRequired
      ? SessionStatus.PENDING
      : SessionStatus.SKIP;
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
