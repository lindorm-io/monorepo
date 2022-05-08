import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_PHONE_NUMBER, SendSmsRequestData } from "../../common";

export const sendSmsSchema = Joi.object<SendSmsRequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_PHONE_NUMBER.required(),
});

export const sendSmsController: Controller<Context<SendSmsRequestData>> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send SMS", data);

  return {};
};
