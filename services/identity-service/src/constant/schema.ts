import Joi from "joi";
import { IdentifierType, NamingSystem } from "@lindorm-io/common-types";

export const JOI_BIRTHDATE = Joi.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);

export const JOI_DISPLAY_NAME_STRING = Joi.string().regex(/^[A-Za-z0-9_+\-]+$/);

export const JOI_IDENTIFIER_TYPE = Joi.string().valid(...Object.values(IdentifierType));

export const JOI_DISPLAY_NAME_OBJECT = Joi.object({
  name: JOI_DISPLAY_NAME_STRING.allow(null).required(),
  number: Joi.number().allow(null).required(),
});

export const JOI_NAMING_SYSTEM = Joi.string().valid(...Object.values(NamingSystem));

export const JOI_OPENID_ADDRESS = Joi.object({
  country: Joi.string().allow(null).required(),
  locality: Joi.string().allow(null).required(),
  postalCode: Joi.string().allow(null).required(),
  region: Joi.string().allow(null).required(),
  streetAddress: Joi.string().allow(null).required(),
});

export const JOI_ZONE_INFO = Joi.string().regex(/^([A-Z][a-z]+)\/([A-Z][a-z]+)(_[A-Z][a-z]+)*$/);
