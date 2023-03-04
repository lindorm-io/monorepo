import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { SessionStatus, VerifyElevationRequestQuery } from "@lindorm-io/common-types";
import { createURL } from "@lindorm-io/url";
import { updateBrowserSessionElevation, updateClientSessionElevation } from "../../handler";

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
    cache: { elevationSessionCache },
    entity: { elevationSession },
  } = ctx;

  if (elevationSession.status !== SessionStatus.CONFIRMED) {
    throw new ClientError("Invalid session status", {
      description: "Session must be confirmed before it can be verified",
      data: {
        expect: SessionStatus.CONFIRMED,
        actual: elevationSession.status,
      },
    });
  }

  await updateBrowserSessionElevation(ctx, elevationSession);
  await updateClientSessionElevation(ctx, elevationSession);

  await elevationSessionCache.destroy(elevationSession);

  if (elevationSession.redirectUri) {
    return {
      redirect: createURL(elevationSession.redirectUri, {
        query: { state: elevationSession.state },
      }),
    };
  }
};
