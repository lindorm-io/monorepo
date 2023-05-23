import { SessionStatus, VerifyElevationRequestQuery } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { updateBrowserSessionElevation, updateClientSessionElevation } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = VerifyElevationRequestQuery;

export const verifyElevationSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const verifyElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { elevationRequestCache },
    entity: { elevationRequest },
  } = ctx;

  if (elevationRequest.status !== SessionStatus.CONFIRMED) {
    throw new ClientError("Invalid session status", {
      description: "Session must be confirmed before it can be verified",
      data: {
        expect: SessionStatus.CONFIRMED,
        actual: elevationRequest.status,
      },
    });
  }

  await updateBrowserSessionElevation(ctx, elevationRequest);
  await updateClientSessionElevation(ctx, elevationRequest);

  await elevationRequestCache.destroy(elevationRequest);

  if (elevationRequest.redirectUri) {
    return {
      redirect: createURL(elevationRequest.redirectUri, {
        query: { state: elevationRequest.state },
      }),
    };
  }
};
