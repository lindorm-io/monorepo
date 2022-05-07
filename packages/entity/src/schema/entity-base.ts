import Joi from "joi";

export const JOI_ENTITY_BASE = {
  id: Joi.string().guid({ version: "uuidv4", separator: "-" }).required(),
  created: Joi.date().iso().required(),
  revision: Joi.number().integer().min(0).required(),
  updated: Joi.date().iso().required(),
  version: Joi.number().integer().min(0).required(),
};
