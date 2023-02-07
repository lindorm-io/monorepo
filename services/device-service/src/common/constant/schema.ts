import Joi from "joi";
import { OauthClientTypes, SessionStatuses } from "@lindorm-io/common-types";

export const JOI_ARGON_STRING = Joi.string()
  .pattern(/^([$]argon2id[$]).+$/)
  .min(64);

export const JOI_CLIENT_TYPE = Joi.string().valid(
  OauthClientTypes.CONFIDENTIAL,
  OauthClientTypes.PUBLIC,
);

export const JOI_COUNTRY_CODE = Joi.string().length(2).lowercase();

export const JOI_EMAIL = Joi.string()
  .case("lower")
  .email({
    minDomainSegments: 2,
    tlds: { deny: [] },
  });

export const JOI_GUID = Joi.string().guid({ version: "uuidv4" });

export const JOI_JWT = Joi.string().pattern(
  /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+$/,
);

export const JOI_LEVEL_OF_ASSURANCE = Joi.number().valid(0, 1, 2, 3, 4);

export const JOI_LOCALE = Joi.string().regex(/^[a-z]{2}-[A-Z]{2}$/);

export const JOI_NIN = Joi.string().regex(/^[0-9]\d{1,16}$/);

export const JOI_NONCE = Joi.string().min(16).max(256);

export const JOI_PHONE_NUMBER = Joi.string().regex(/^\+?[0-9]\d{1,14}$/);

export const JOI_SCOPE_DESCRIPTION = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
});

export const JOI_SESSION_STATUS = Joi.string().valid(
  SessionStatuses.ACKNOWLEDGED,
  SessionStatuses.CODE,
  SessionStatuses.CONFIRMED,
  SessionStatuses.EXPIRED,
  SessionStatuses.PENDING,
  SessionStatuses.REJECTED,
  SessionStatuses.SKIP,
  SessionStatuses.VERIFIED,
);

export const JOI_STATE = Joi.string().min(16).max(256);
