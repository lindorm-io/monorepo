import Joi from "joi";
import { AggregateCommandHandler, HandlerConditions } from "../types";

export const JOI_AGGREGATE_COMMAND_HANDLER_FILE = Joi.object<AggregateCommandHandler>().keys({
  command: Joi.function().required(),
  conditions: Joi.object<HandlerConditions>()
    .keys({
      created: Joi.boolean().optional(),
      permanent: Joi.boolean().optional(),
    })
    .optional(),
  schema: Joi.object().required(),
  handler: Joi.function().required(),
});
