import Joi from "joi";
import { QueryHandler } from "../types";

export const JOI_QUERY_HANDLER_FILE = Joi.object<QueryHandler>().keys({
  query: Joi.function().required(),
  view: Joi.string().required(),
  context: Joi.string().optional(),
  handler: Joi.function().required(),
});
