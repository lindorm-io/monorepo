import Joi from "joi";
import { AggregateCommandHandler, HandlerConditions } from "../types";

export const JOI_AGGREGATE_COMMAND_HANDLER_FILE = Joi.object<
  AggregateCommandHandler<unknown, unknown>
>().keys({
  conditions: Joi.object<HandlerConditions>()
    .keys({
      created: Joi.boolean().optional(),
      permanent: Joi.boolean().optional(),
    })
    .optional(),
  schema: Joi.object().required(),
  version: Joi.number().optional(),
  handler: Joi.function().required(),
});
