import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { EmitSocketEventRequestData } from "../../common";

export const emitSocketEventSchema = Joi.object<EmitSocketEventRequestData>().keys({
  channels: Joi.object()
    .keys({
      sessions: Joi.array().items(Joi.string()).optional(),
      deviceLinks: Joi.array().items(Joi.string()).optional(),
      identities: Joi.array().items(Joi.string()).optional(),
    })
    .required(),
  content: Joi.object().required(),
  event: Joi.string().required(),
});

export const emitSocketEventController: Controller<Context<EmitSocketEventRequestData>> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Emit Socket", data);

  return {};
};
