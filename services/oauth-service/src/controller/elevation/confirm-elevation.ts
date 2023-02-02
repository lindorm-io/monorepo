import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertAcrValues, assertSessionPending } from "../../util";
import { stringComparison } from "@lindorm-io/node-pkce";
import {
  ConfirmElevationRequestBody,
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  SessionStatus,
} from "../../common";

interface RequestData extends ConfirmElevationRequestBody {
  id: string;
}

export const confirmElevationSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    acrValues: Joi.array().items(Joi.string().lowercase()).required(),
    amrValues: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: JOI_GUID.required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
  })
  .required();

export const confirmElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { elevationSessionCache },
    data: { acrValues, amrValues, identityId, levelOfAssurance },
    entity: { elevationSession },
    logger,
  } = ctx;

  assertSessionPending(elevationSession.status);
  assertAcrValues(acrValues);

  if (!stringComparison(identityId, elevationSession.identityId)) {
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

  elevationSession.confirmedAuthentication.acrValues = acrValues;
  elevationSession.confirmedAuthentication.amrValues = amrValues;
  elevationSession.confirmedAuthentication.latestAuthentication = new Date();
  elevationSession.confirmedAuthentication.levelOfAssurance = levelOfAssurance;

  elevationSession.status = SessionStatus.CONFIRMED;

  await elevationSessionCache.update(elevationSession);
};
