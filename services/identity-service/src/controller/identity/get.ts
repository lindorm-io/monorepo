import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetUserinfoResponseBody, JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { getUserinfoResponseBody } from "../../handler";

interface RequestData {
  id: string;
}

export const identityGetSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const identityGetController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetUserinfoResponseBody> => {
  const {
    entity: { identity },
    token: {
      bearerToken: { scopes },
    },
  } = ctx;

  const body = await getUserinfoResponseBody(ctx, identity, scopes);

  return { body };
};
