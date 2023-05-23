import {
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdPromptMode,
  OpenIdResponseMode,
  OpenIdResponseType,
  PKCEMethod,
} from "@lindorm-io/common-types";
import Joi from "joi";

export const JOI_CODE = Joi.string().length(128);

export const JOI_CODE_CHALLENGE = Joi.string().min(32).max(256);

export const JOI_PKCE_METHOD = Joi.string().valid(...Object.values(PKCEMethod));

export const JOI_DISPLAY_MODE = Joi.string().valid(...Object.values(OpenIdDisplayMode));

export const JOI_EXPIRY_REGEX = Joi.string().pattern(
  /^([0-9]){1,2}\s(years|months|days|minutes|seconds)$/,
);

export const JOI_GRANT_TYPE = Joi.string().valid(...Object.values(OpenIdGrantType));

export const JOI_PROMPT_MODE = Joi.string().valid(...Object.values(OpenIdPromptMode));

export const JOI_PROMPT_REGEX = Joi.string().pattern(
  /^((consent|login|none|select_account)+(\s|\+)?)+$/,
);

export const JOI_RESPONSE_MODE = Joi.string().valid(...Object.values(OpenIdResponseMode));

export const JOI_RESPONSE_TYPE = Joi.string().valid(...Object.values(OpenIdResponseType));

export const JOI_RESPONSE_TYPE_REGEX = Joi.string().pattern(/^((token|id_token|code)+(\s|\+)?)+$/);
