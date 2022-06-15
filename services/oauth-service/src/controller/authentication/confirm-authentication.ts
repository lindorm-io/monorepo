import Joi from "joi";
import { ALLOWED_ACR_VALUES } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { configuration } from "../../server/configuration";
import { createAuthorizationVerifyRedirectUri } from "../../util";
import { difference, includes } from "lodash";
import { getExpiryDate } from "@lindorm-io/core";
import {
  ConfirmAuthenticationRequestBody,
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  ResponseWithRedirectBody,
  SessionStatus,
} from "../../common";

interface RequestData extends ConfirmAuthenticationRequestBody {
  id: string;
}

export const confirmAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    acrValues: Joi.array().items(Joi.string().lowercase()).required(),
    amrValues: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: JOI_GUID.required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    remember: Joi.boolean().required(),
  })
  .required();

export const confirmAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    data: { acrValues, amrValues, identityId, levelOfAssurance, remember },
    entity: { authorizationSession, browserSession },
    logger,
    repository: { browserSessionRepository },
  } = ctx;

  if (
    includes(
      [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP],
      authorizationSession.authenticationStatus,
    )
  ) {
    throw new ClientError("Authentication has already been set");
  }

  const acrDiff = difference(acrValues, ALLOWED_ACR_VALUES);

  if (acrDiff.length) {
    throw new ClientError("Invalid ACR Values", {
      description: "The provided ACR values are invalid",
      data: {
        allowed: ALLOWED_ACR_VALUES,
        diff: acrDiff,
      },
    });
  }

  if (browserSession.identityId && browserSession.identityId !== identityId) {
    throw new ClientError("Invalid Identity", {
      description: "The provided Identity does not match browser session Identity",
      debug: {
        expect: browserSession.identityId,
        actual: identityId,
      },
    });
  }

  logger.debug("Updating browser session");

  browserSession.acrValues = acrValues;
  browserSession.amrValues = amrValues;
  browserSession.country = authorizationSession.country;
  browserSession.expires = remember
    ? getExpiryDate(configuration.defaults.expiry.browser_session_remember)
    : browserSession.expires;
  browserSession.identityId = identityId;
  browserSession.latestAuthentication = new Date();
  browserSession.levelOfAssurance = levelOfAssurance;
  browserSession.nonce = authorizationSession.nonce;
  browserSession.remember = remember;

  await browserSessionRepository.update(browserSession);

  logger.debug("Updating authorization session");

  authorizationSession.authenticationStatus = SessionStatus.CONFIRMED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationVerifyRedirectUri(authorizationSession) } };
};
