import Joi from "joi";
import {
  HandlerConditions,
  MongoSagaStoreHandlerOptions,
  SagaEventHandlerFile,
  SagaEventHandlerFileAggregate,
  SagaStoreHandlerOptions,
} from "../types";

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
  options: Joi.object<SagaStoreHandlerOptions>()
    .keys({
      mongo: Joi.object<MongoSagaStoreHandlerOptions>().optional(),
    })
    .optional(),
  getSagaId: Joi.function().required(),
  handler: Joi.function().required(),
});
