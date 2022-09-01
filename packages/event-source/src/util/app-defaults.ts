import Joi from "joi";

export const defaultAggregateCommandHandlerSchema: Joi.Schema = Joi.object()
  .unknown(true)
  .optional();
