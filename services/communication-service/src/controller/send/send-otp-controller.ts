import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_EMAIL, SendCodeRequestData } from "../../common";
import { ServerKoaController } from "../../types";

export const sendOtpSchema = Joi.object<SendCodeRequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_EMAIL.required(),
  type: Joi.string().required(),
});

export const sendOtpController: ServerKoaController<SendCodeRequestData> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send Otp", data);
};
