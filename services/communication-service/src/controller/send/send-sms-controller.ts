import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_PHONE_NUMBER } from "../../common";

interface RequestData {
  content: Record<string, unknown>;
  template: string;
  to: string;
}

export const sendSmsSchema = Joi.object<RequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_PHONE_NUMBER.required(),
});

export const sendSmsController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send SMS", data);

  return {};
};
