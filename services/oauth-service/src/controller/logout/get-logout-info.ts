import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, GetLogoutSessionInfoResponseBody } from "../../common";
import { getExpires } from "@lindorm-io/core";

interface RequestData {
  id: string;
}

export const getLogoutInfoSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const getLogoutInfoController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<GetLogoutSessionInfoResponseBody> => {
  const {
    entity: { client, logoutSession },
  } = ctx;

  const { expires, expiresIn } = getExpires(logoutSession.expires);

  return {
    body: {
      client: {
        description: client.description,
        logoUri: client.logoUri,
        name: client.name,
        type: client.type,
      },
      logoutSession: {
        id: logoutSession.id,
        expiresAt: expires.toISOString(),
        expiresIn,
        originalUri: logoutSession.originalUri,
      },
      logoutStatus: logoutSession.status,
    },
  };
};
