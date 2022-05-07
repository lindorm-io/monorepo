import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_EMAIL } from "../../common";

interface RequestData {
  content: Record<string, unknown>;
  template: string;
  to: string;
}

export const sendEmailSchema = Joi.object<RequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_EMAIL.required(),
});

export const sendEmailController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send Email", data);

  return {};
};
