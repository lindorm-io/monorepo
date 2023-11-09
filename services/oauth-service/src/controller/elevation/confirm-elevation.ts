import { SessionStatus } from "@lindorm-io/common-enums";
import {
  ConfirmElevationSessionRequestBody,
  ConfirmElevationSessionRequestParams,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../../common";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createElevationVerifyUri } from "../../util";

type RequestData = ConfirmElevationSessionRequestParams & ConfirmElevationSessionRequestBody;

export const confirmElevationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    factors: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: Joi.string().guid().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    strategies: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export const confirmElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { elevationSessionCache },
    data: { factors, identityId, levelOfAssurance, metadata, methods, strategies },
    entity: { elevationSession },
    logger,
  } = ctx;

  assertSessionPending(elevationSession.status);

  if (identityId !== elevationSession.identityId) {
    throw new ClientError("Invalid identity", {
      description: "The provided identityId is invalid",
      debug: {
        expect: elevationSession.identityId,
        actual: identityId,
      },
    });
  }

  if (levelOfAssurance < elevationSession.requestedAuthentication.minimumLevelOfAssurance) {
    throw new ClientError("Invalid level", {
      description: "The provided LOA value is below minimum value",
      data: {
        expect: elevationSession.requestedAuthentication.minimumLevelOfAssurance,
        actual: levelOfAssurance,
      },
    });
  }

  if (levelOfAssurance < elevationSession.requestedAuthentication.levelOfAssurance) {
    throw new ClientError("Invalid level", {
      description: "The provided LOA value is below the defined required value",
      data: {
        expect: elevationSession.requestedAuthentication.levelOfAssurance,
        actual: levelOfAssurance,
      },
    });
  }

  logger.debug("Updating elevation session");

  elevationSession.confirmedAuthentication.factors = factors;
  elevationSession.confirmedAuthentication.latestAuthentication = new Date();
  elevationSession.confirmedAuthentication.levelOfAssurance = levelOfAssurance;
  elevationSession.confirmedAuthentication.metadata = metadata;
  elevationSession.confirmedAuthentication.methods = methods;
  elevationSession.confirmedAuthentication.strategies = strategies;

  elevationSession.status = SessionStatus.CONFIRMED;

  await elevationSessionCache.update(elevationSession);

  if (elevationSession.redirectUri) {
    return { body: { redirectTo: createElevationVerifyUri(elevationSession) } };
  }
};
