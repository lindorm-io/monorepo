import Joi from "joi";
import { AggregateEventHandlerFile } from "../types";

export const JOI_AGGREGATE_EVENT_HANDLER_FILE = Joi.object<AggregateEventHandlerFile>().keys({
  handler: Joi.function().required(),
});
