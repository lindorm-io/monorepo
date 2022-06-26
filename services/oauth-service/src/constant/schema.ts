import Joi from "joi";
import { PKCEMethod } from "@lindorm-io/core";
import { DisplayMode, GrantType, PromptMode, ResponseMode, ResponseType } from "../common";

export const JOI_CODE = Joi.string().length(128);

export const JOI_CODE_CHALLENGE = Joi.string().min(32).max(256);

export const JOI_PKCE_METHOD = Joi.string().valid(PKCEMethod.PLAIN, PKCEMethod.S256);

export const JOI_DISPLAY_MODE = Joi.string().valid(
  DisplayMode.PAGE,
  DisplayMode.POPUP,
  DisplayMode.TOUCH,
  DisplayMode.WAP,
);

export const JOI_EXPIRY_REGEX = Joi.string().pattern(
  /^([0-9]){1,2}\s(years|months|days|minutes|seconds)$/,
);

export const JOI_GRANT_TYPE = Joi.string().valid(
  GrantType.AUTHORIZATION_CODE,
  GrantType.CLIENT_CREDENTIALS,
  GrantType.REFRESH_TOKEN,
);

export const JOI_PROMPT_MODE = Joi.string().valid(
  PromptMode.CONSENT,
  PromptMode.LOGIN,
  PromptMode.NONE,
  PromptMode.SELECT_ACCOUNT,
);

export const JOI_PROMPT_REGEX = Joi.string().pattern(
  /^((consent|login|none|select_account)+(\s)?)+$/,
);

export const JOI_RESPONSE_MODE = Joi.string().valid(
  ResponseMode.FORM_POST,
  ResponseMode.FRAGMENT,
  ResponseMode.QUERY,
);

export const JOI_RESPONSE_TYPE = Joi.string().valid(
  ResponseType.CODE,
  ResponseType.ID_TOKEN,
  ResponseType.TOKEN,
);

export const JOI_RESPONSE_TYPE_REGEX = Joi.string().pattern(/^((token|id_token|code)+(\s)?)+$/);
