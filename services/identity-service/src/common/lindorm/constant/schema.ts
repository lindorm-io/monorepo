import Joi from "joi";
import { SessionStatus } from "../enum";

export const JOI_ARGON_STRING = Joi.string()
  .pattern(/^([$]argon2id[$]).+$/)
  .min(64);

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

export const JOI_NIN = Joi.string().regex(/^[0-9]\d{1,16}$/);

export const JOI_PHONE_NUMBER = Joi.string().regex(/^\+?[0-9]\d{1,14}$/);

export const JOI_SCOPE_DESCRIPTION = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
});

export const JOI_SESSION_STATUS = Joi.string().valid(
  SessionStatus.ACKNOWLEDGED,
  SessionStatus.CONFIRMED,
  SessionStatus.EXPIRED,
  SessionStatus.PENDING,
  SessionStatus.REJECTED,
  SessionStatus.SKIP,
);
