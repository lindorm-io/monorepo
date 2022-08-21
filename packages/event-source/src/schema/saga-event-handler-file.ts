import Joi from "joi";
import { HandlerConditions, SagaEventHandlerFile, SagaEventHandlerFileAggregate } from "../types";

export const JOI_SAGA_EVENT_HANDLER_FILE = Joi.object<SagaEventHandlerFile>().keys({
  aggregate: Joi.object<SagaEventHandlerFileAggregate>()
    .keys({
      context: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())).optional(),
    })
    .optional(),
  conditions: Joi.object<HandlerConditions>()
    .keys({
      created: Joi.boolean().optional(),
      permanent: Joi.boolean().optional(),
    })
    .optional(),
  version: Joi.number().optional(),
  getSagaId: Joi.function().required(),
  handler: Joi.function().required(),
});
