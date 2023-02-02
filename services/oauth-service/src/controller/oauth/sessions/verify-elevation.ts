import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../../common";
import { ServerKoaController } from "../../../types";
import { createURL } from "@lindorm-io/url";
import { verifyBrowserSessionElevation, verifyRefreshSessionElevation } from "../../../handler";

type RequestData = {
  sessionId: string;
};

export const verifyElevationSchema = Joi.object<RequestData>()
  .keys({
    sessionId: JOI_GUID.required(),
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

  if (elevationSession.identifiers.browserSessionId) {
    await verifyBrowserSessionElevation(ctx, elevationSession);
  }

  if (elevationSession.identifiers.refreshSessionId) {
    await verifyRefreshSessionElevation(ctx, elevationSession);
  }

  await elevationSessionCache.destroy(elevationSession);

  if (elevationSession.redirectUri) {
    return {
      redirect: createURL(elevationSession.redirectUri, {
        query: { state: elevationSession.state },
      }),
    };
  }
};
