import Joi from "joi";
import {
  HandlerConditions,
  ViewEventHandlerStoreOptions,
  ViewEventHandler,
  ViewEventHandlerFileAggregate,
  StoreIndex,
} from "../types";

export const JOI_VIEW_EVENT_HANDLER_FILE = Joi.object<ViewEventHandler<unknown>>().keys({
  event: Joi.function().required(),
  view: Joi.string().required(),
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
  options: Joi.object<ViewEventHandlerStoreOptions>()
    .keys({
      custom: Joi.object().optional(),
      indexes: Joi.array()
        .items(
          Joi.object<StoreIndex>().keys({
            fields: Joi.array().items(Joi.string()).required(),
            name: Joi.string().required(),
            unique: Joi.boolean().required(),
          }),
        )
        .optional(),
      type: Joi.string().allow("custom", "memory", "mongo", "postgres").optional(),
    })
    .optional(),
  version: Joi.number().optional(),
  getViewId: Joi.function().required(),
  handler: Joi.function().required(),
});
