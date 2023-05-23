import { AuthenticationMethod, AuthenticationStrategy, PKCEMethod } from "@lindorm-io/common-types";
import Joi from "joi";

export const JOI_AUTHENTICATION_METHOD = Joi.string().valid(...Object.values(AuthenticationMethod));

export const JOI_AUTHENTICATION_STRATEGY = Joi.string().valid(
  ...Object.values(AuthenticationStrategy),
);

export const JOI_PKCE_METHOD = Joi.string().valid(...Object.values(PKCEMethod));
