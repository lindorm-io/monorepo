import Joi from "joi";
import { ErrorHandler, SagaEventHandlerFileAggregate } from "../types";

export const JOI_ERROR_HANDLER_FILE = Joi.object<ErrorHandler>().keys({
  error: Joi.function().required(),
  aggregate: Joi.object<SagaEventHandlerFileAggregate>()
    .keys({
      context: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())).optional(),
    })
    .optional(),
  handler: Joi.function().required(),
});
