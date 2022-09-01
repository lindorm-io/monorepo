import Joi from "joi";
import { AggregateEventHandler } from "../types";

export const JOI_AGGREGATE_EVENT_HANDLER_FILE = Joi.object<AggregateEventHandler<unknown>>().keys({
  event: Joi.function().required(),
  version: Joi.number().optional(),
  handler: Joi.function().required(),
});
