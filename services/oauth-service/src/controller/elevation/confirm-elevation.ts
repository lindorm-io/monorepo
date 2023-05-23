import {
  ConfirmElevationRequestBody,
  ConfirmElevationRequestParams,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../../common";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createElevationVerifyUri } from "../../util";

type RequestData = ConfirmElevationRequestParams & ConfirmElevationRequestBody;

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
    redis: { elevationRequestCache },
    data: { identityId, levelOfAssurance, methods },
    entity: { elevationRequest },
    logger,
  } = ctx;

  assertSessionPending(elevationRequest.status);

  if (identityId !== elevationRequest.identityId) {
    throw new ClientError("Invalid identity", {
      description: "The provided identityId is invalid",
      debug: {
        expect: elevationRequest.identityId,
        actual: identityId,
      },
    });
  }

  if (levelOfAssurance < elevationRequest.requestedAuthentication.minimumLevel) {
    throw new ClientError("Invalid level", {
      description: "The provided LOA value is below minimum value",
      data: {
        expect: elevationRequest.requestedAuthentication.minimumLevel,
        actual: levelOfAssurance,
      },
    });
  }

  if (levelOfAssurance < elevationRequest.requestedAuthentication.requiredLevel) {
    throw new ClientError("Invalid level", {
      description: "The provided LOA value is below the defined required value",
      data: {
        expect: elevationRequest.requestedAuthentication.requiredLevel,
        actual: levelOfAssurance,
      },
    });
  }

  logger.debug("Updating elevation session");

  elevationRequest.confirmedAuthentication.latestAuthentication = new Date();
  elevationRequest.confirmedAuthentication.levelOfAssurance = levelOfAssurance;
  elevationRequest.confirmedAuthentication.methods = methods;

  elevationRequest.status = SessionStatus.CONFIRMED;

  await elevationRequestCache.update(elevationRequest);

  if (elevationRequest.redirectUri) {
    return { body: { redirectTo: createElevationVerifyUri(elevationRequest) } };
  }
};
