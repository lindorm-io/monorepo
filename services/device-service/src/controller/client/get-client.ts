import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
};

type ResponseBody = {
  active: boolean;
  name: string | null;
  publicKeyId: string;
};

export const getClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { client },
  } = ctx;

  return {
    body: {
      active: client.active,
      name: client.name,
      publicKeyId: client.publicKeyId,
    },
  };
};
