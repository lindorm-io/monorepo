import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_EMAIL, SendEmailRequestData } from "../../common";

export const sendEmailSchema = Joi.object<SendEmailRequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_EMAIL.required(),
});

export const sendEmailController: Controller<Context<SendEmailRequestData>> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send Email", data);

  return {};
};
