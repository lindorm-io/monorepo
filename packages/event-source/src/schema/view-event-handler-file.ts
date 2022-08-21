import Joi from "joi";
import {
  HandlerConditions,
  MongoViewEventHandlerAdapterOptions,
  PostgresViewEventHandlerAdapterOptions,
  ViewEventHandlerAdapters,
  ViewEventHandlerFile,
  ViewEventHandlerFileAggregate,
} from "../types";

export const JOI_VIEW_EVENT_HANDLER_FILE = Joi.object<ViewEventHandlerFile>().keys({
  aggregate: Joi.object<ViewEventHandlerFileAggregate>()
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
  adapters: Joi.object<ViewEventHandlerAdapters>()
    .keys({
      mongo: Joi.object<MongoViewEventHandlerAdapterOptions>().optional(),
      postgres: Joi.object<PostgresViewEventHandlerAdapterOptions>().optional(),
      type: Joi.string().allow("custom", "mongo", "postgres"),
    })
    .optional(),
  version: Joi.number().optional(),
  getViewId: Joi.function().required(),
  handler: Joi.function().required(),
});
