import Joi from "joi";
import { AggregateEventHandler } from "../types";

export const JOI_AGGREGATE_EVENT_HANDLER_FILE = Joi.object<AggregateEventHandler>().keys({
  event: Joi.function().required(),
  handler: Joi.function().required(),
});
