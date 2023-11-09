import { SessionStatus } from "@lindorm-io/common-enums";
import { VerifyElevationSessionRequestQuery } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { updateBrowserSessionElevation, updateClientSessionElevation } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = VerifyElevationSessionRequestQuery;

export const verifyElevationSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const verifyElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { elevationSessionCache },
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
