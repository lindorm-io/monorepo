import Joi from "joi";
import {
  AuthenticationMethods,
  AuthenticationStrategies,
  PKCEMethods,
} from "@lindorm-io/common-types";

export const JOI_AUTHENTICATION_METHOD = Joi.string().valid(
  ...Object.values(AuthenticationMethods),
);

export const JOI_AUTHENTICATION_STRATEGY = Joi.string().valid(
  ...Object.values(AuthenticationStrategies),
);

export const JOI_PKCE_METHOD = Joi.string().valid(...Object.values(PKCEMethods));
