import Joi from "joi";
import { AuthenticationMethod } from "../common";
import { AuthenticationStrategy } from "../enum";
import { PKCEMethod } from "@lindorm-io/core";

export const JOI_AUTHENTICATION_METHOD = Joi.string().valid(...Object.values(AuthenticationMethod));

export const JOI_AUTHENTICATION_STRATEGY = Joi.string().valid(
  ...Object.values(AuthenticationStrategy),
);

export const JOI_PKCE_METHOD = Joi.string().valid(PKCEMethod.PLAIN, PKCEMethod.S256);
