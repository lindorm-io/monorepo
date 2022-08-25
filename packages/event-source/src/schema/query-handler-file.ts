import Joi from "joi";
import { QueryHandler, HandlerIdentifierOptionalContext } from "../types";

export const JOI_QUERY_HANDLER_FILE = Joi.object<QueryHandler<unknown, unknown>>().keys({
  view: Joi.object<HandlerIdentifierOptionalContext>()
    .keys({
      name: Joi.string().required(),
      context: Joi.string().optional(),
    })
    .optional(),
  handler: Joi.function().required(),
});
