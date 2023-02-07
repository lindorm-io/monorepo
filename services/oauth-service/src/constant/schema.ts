import Joi from "joi";
import {
  OauthDisplayModes,
  OauthGrantTypes,
  OauthPromptModes,
  OauthResponseModes,
  OauthResponseTypes,
  PKCEMethods,
} from "@lindorm-io/common-types";

export const JOI_CODE = Joi.string().length(128);

export const JOI_CODE_CHALLENGE = Joi.string().min(32).max(256);

export const JOI_PKCE_METHOD = Joi.string().valid(PKCEMethods.PLAIN, PKCEMethods.SHA256);

export const JOI_DISPLAY_MODE = Joi.string().valid(
  OauthDisplayModes.PAGE,
  OauthDisplayModes.POPUP,
  OauthDisplayModes.TOUCH,
  OauthDisplayModes.WAP,
);

export const JOI_EXPIRY_REGEX = Joi.string().pattern(
  /^([0-9]){1,2}\s(years|months|days|minutes|seconds)$/,
);

export const JOI_GRANT_TYPE = Joi.string().valid(
  OauthGrantTypes.AUTHORIZATION_CODE,
  OauthGrantTypes.CLIENT_CREDENTIALS,
  OauthGrantTypes.REFRESH_TOKEN,
);

export const JOI_PROMPT_MODE = Joi.string().valid(
  OauthPromptModes.CONSENT,
  OauthPromptModes.LOGIN,
  OauthPromptModes.NONE,
  OauthPromptModes.SELECT_ACCOUNT,
);

export const JOI_PROMPT_REGEX = Joi.string().pattern(
  /^((consent|login|none|select_account)+(\s)?)+$/,
);

export const JOI_RESPONSE_MODE = Joi.string().valid(
  OauthResponseModes.FORM_POST,
  OauthResponseModes.FRAGMENT,
  OauthResponseModes.QUERY,
);

export const JOI_RESPONSE_TYPE = Joi.string().valid(
  OauthResponseTypes.CODE,
  OauthResponseTypes.ID_TOKEN,
  OauthResponseTypes.TOKEN,
);

export const JOI_RESPONSE_TYPE_REGEX = Joi.string().pattern(/^((token|id_token|code)+(\s)?)+$/);
