import { GetSagaIdFunction, GetViewIdFunction } from "../types";
import Joi from "joi";

export const defaultAggregateCommandHandlerSchema: Joi.Schema = Joi.object()
  .unknown(true)
  .optional();

export const defaultSagaIdFunction: GetSagaIdFunction = (event) => event.aggregate.id;

export const defaultViewIdFunction: GetViewIdFunction = (event) => event.aggregate.id;
