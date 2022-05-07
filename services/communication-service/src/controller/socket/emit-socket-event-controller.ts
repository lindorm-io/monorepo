import Joi from "joi";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { Context } from "../../types";

interface RequestData {
  channels: {
    sessions: Array<string>;
    deviceLinks: Array<string>;
    identities: Array<string>;
  };
  content: Record<string, unknown>;
  event: string;
}

export const emitSocketEventSchema = Joi.object<RequestData>().keys({
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

export const emitSocketEventController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Emit Socket", data);

  return {};
};
