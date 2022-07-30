import Joi from "joi";
import {
  HandlerConditions,
  MongoViewStoreHandlerOptions,
  RedisViewStoreHandlerOptions,
  ViewEventHandlerFile,
  ViewEventHandlerFileAggregate,
  ViewStoreHandlerOptions,
} from "../types";
import { PostgresViewStoreHandlerOptions } from "../types/view-store/view-store-postgres";

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
  persistence: Joi.object<ViewStoreHandlerOptions>()
    .keys({
      mongo: Joi.object<MongoViewStoreHandlerOptions>().optional(),
      postgres: Joi.object<PostgresViewStoreHandlerOptions>().optional(),
      redis: Joi.object<RedisViewStoreHandlerOptions>().optional(),
      type: Joi.string().allow("custom", "mongo", "postgres", "redis"),
    })
    .optional(),
  getViewId: Joi.function().required(),
  handler: Joi.function().required(),
});
