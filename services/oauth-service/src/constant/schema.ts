import Joi from "joi";
import {
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdPromptMode,
  OpenIdResponseMode,
  OpenIdResponseType,
  PKCEMethod,
} from "@lindorm-io/common-types";

export const JOI_CODE = Joi.string().length(128);

export const JOI_CODE_CHALLENGE = Joi.string().min(32).max(256);

export const JOI_PKCE_METHOD = Joi.string().valid(PKCEMethod.PLAIN, PKCEMethod.SHA256);

export const JOI_DISPLAY_MODE = Joi.string().valid(
  OpenIdDisplayMode.PAGE,
  OpenIdDisplayMode.POPUP,
  OpenIdDisplayMode.TOUCH,
  OpenIdDisplayMode.WAP,
);

export const JOI_EXPIRY_REGEX = Joi.string().pattern(
  /^([0-9]){1,2}\s(years|months|days|minutes|seconds)$/,
);

export const JOI_GRANT_TYPE = Joi.string().valid(
  OpenIdGrantType.AUTHORIZATION_CODE,
  OpenIdGrantType.CLIENT_CREDENTIALS,
  OpenIdGrantType.REFRESH_TOKEN,
);

export const JOI_PROMPT_MODE = Joi.string().valid(
  OpenIdPromptMode.CONSENT,
  OpenIdPromptMode.LOGIN,
  OpenIdPromptMode.NONE,
  OpenIdPromptMode.SELECT_ACCOUNT,
);

export const JOI_PROMPT_REGEX = Joi.string().pattern(
  /^((consent|login|none|select_account)+(\s|\+)?)+$/,
);

export const JOI_RESPONSE_MODE = Joi.string().valid(
  OpenIdResponseMode.FORM_POST,
  OpenIdResponseMode.FRAGMENT,
  OpenIdResponseMode.QUERY,
);

export const JOI_RESPONSE_TYPE = Joi.string().valid(
  OpenIdResponseType.CODE,
  OpenIdResponseType.ID_TOKEN,
  OpenIdResponseType.TOKEN,
);

export const JOI_RESPONSE_TYPE_REGEX = Joi.string().pattern(/^((token|id_token|code)+(\s|\+)?)+$/);
