import Joi from "joi";
import {
  HandlerConditions,
  StoreIndex,
  ViewEventHandler,
  ViewEventHandlerAdapter,
  ViewEventHandlerFileAggregate,
} from "../types";

export const JOI_VIEW_EVENT_HANDLER_FILE = Joi.object<ViewEventHandler>().keys({
  event: Joi.function().required(),
  adapter: Joi.object<ViewEventHandlerAdapter>()
    .keys({
      custom: Joi.object(),
      indexes: Joi.array().items(
        Joi.object<StoreIndex>().keys({
          fields: Joi.array().items(Joi.string()).required(),
          name: Joi.string().required(),
          unique: Joi.boolean().required(),
        }),
      ),
      type: Joi.string().allow("custom", "memory", "mongo", "postgres").required(),
    })
    .required(),
  aggregate: Joi.object<ViewEventHandlerFileAggregate>().keys({
    name: Joi.string(),
    context: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
  }),
  conditions: Joi.object<HandlerConditions>().keys({
    created: Joi.boolean(),
    permanent: Joi.boolean(),
  }),
  getViewId: Joi.function(),
  handler: Joi.function().required(),
});
