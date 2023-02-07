import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_EMAIL } from "../../common";
import { ServerKoaController } from "../../types";
import { SendCodeRequestBody } from "@lindorm-io/common-types";

type RequestData = SendCodeRequestBody;

export const sendCodeSchema = Joi.object<RequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_EMAIL.required(),
  type: Joi.string().required(),
});

export const sendCodeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send Code", data);
};
