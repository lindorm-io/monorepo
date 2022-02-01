import Joi from "joi";
import { ClientType } from "../enum";

export const JOI_CLIENT_TYPE = Joi.string().valid(ClientType.PUBLIC, ClientType.CONFIDENTIAL);

export const JOI_COUNTRY_CODE = Joi.string().length(2).lowercase();

export const JOI_LEVEL_OF_ASSURANCE = Joi.number().valid(0, 1, 2, 3, 4);

export const JOI_LOCALE = Joi.string().regex(/^[a-z]{2}-[A-Z]{2}$/);

export const JOI_NONCE = Joi.string().min(16).max(256);

export const JOI_STATE = Joi.string().min(16).max(256).base64();
