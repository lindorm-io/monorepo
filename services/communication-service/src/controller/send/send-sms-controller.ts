import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_PHONE_NUMBER, SendSmsRequestData } from "../../common";
import { ServerKoaController } from "../../types";

export const sendSmsSchema = Joi.object<SendSmsRequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_PHONE_NUMBER.required(),
});

export const sendSmsController: ServerKoaController<SendSmsRequestData> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send SMS", data);
};
