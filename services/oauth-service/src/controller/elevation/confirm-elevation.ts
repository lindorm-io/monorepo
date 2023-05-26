import {
  ConfirmElevationSessionRequestBody,
  ConfirmElevationSessionRequestParams,
  SessionStatus,
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
    identityId: Joi.string().guid().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export const confirmElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { elevationSessionCache },
    data: { identityId, levelOfAssurance, methods },
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

  if (levelOfAssurance < elevationSession.requestedAuthentication.minimumLevel) {
    throw new ClientError("Invalid level", {
      description: "The provided LOA value is below minimum value",
      data: {
        expect: elevationSession.requestedAuthentication.minimumLevel,
        actual: levelOfAssurance,
      },
    });
  }

  if (levelOfAssurance < elevationSession.requestedAuthentication.requiredLevel) {
    throw new ClientError("Invalid level", {
      description: "The provided LOA value is below the defined required value",
      data: {
        expect: elevationSession.requestedAuthentication.requiredLevel,
        actual: levelOfAssurance,
      },
    });
  }

  logger.debug("Updating elevation session");

  elevationSession.confirmedAuthentication.latestAuthentication = new Date();
  elevationSession.confirmedAuthentication.levelOfAssurance = levelOfAssurance;
  elevationSession.confirmedAuthentication.methods = methods;

  elevationSession.status = SessionStatus.CONFIRMED;

  await elevationSessionCache.update(elevationSession);

  if (elevationSession.redirectUri) {
    return { body: { redirectTo: createElevationVerifyUri(elevationSession) } };
  }
};
