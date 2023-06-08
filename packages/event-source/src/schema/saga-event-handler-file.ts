import Joi from "joi";
import { HandlerConditions, SagaEventHandler, SagaEventHandlerFileAggregate } from "../types";

export const JOI_SAGA_EVENT_HANDLER_FILE = Joi.object<SagaEventHandler>().keys({
  event: Joi.function().required(),
  aggregate: Joi.object<SagaEventHandlerFileAggregate>().keys({
    name: Joi.string(),
    context: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
  }),
  conditions: Joi.object<HandlerConditions>().keys({
    created: Joi.boolean(),
    permanent: Joi.boolean(),
  }),
  getSagaId: Joi.function(),
  handler: Joi.function().required(),
});
