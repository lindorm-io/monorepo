import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_EMAIL, SendEmailRequestData } from "../../common";
import { ServerKoaController } from "../../types";

export const sendEmailSchema = Joi.object<SendEmailRequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_EMAIL.required(),
});

export const sendEmailController: ServerKoaController<SendEmailRequestData> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send Email", data);
};
