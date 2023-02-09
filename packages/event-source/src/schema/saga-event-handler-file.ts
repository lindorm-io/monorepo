import Joi from "joi";
import { HandlerConditions, SagaEventHandler, SagaEventHandlerFileAggregate } from "../types";

export const JOI_SAGA_EVENT_HANDLER_FILE = Joi.object<SagaEventHandler>().keys({
  event: Joi.function().required(),
  saga: Joi.string().required(),
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
  getSagaId: Joi.function().optional(),
  handler: Joi.function().required(),
});
