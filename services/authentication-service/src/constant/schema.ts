import Joi from "joi";
import { AuthenticationMethod } from "../enum";
import { PKCEMethod } from "@lindorm-io/core";

export const JOI_AUTHENTICATION_METHOD = Joi.string().valid(
  AuthenticationMethod.BANK_ID_SE,
  AuthenticationMethod.DEVICE_CHALLENGE,
  AuthenticationMethod.EMAIL_LINK,
  AuthenticationMethod.EMAIL_OTP,
  AuthenticationMethod.MFA_COOKIE,
  AuthenticationMethod.PASSWORD,
  AuthenticationMethod.PASSWORD_BROWSER_LINK,
  AuthenticationMethod.PHONE_OTP,
  AuthenticationMethod.RDC_QR_CODE,
  AuthenticationMethod.SESSION_ACCEPT_WITH_CODE,
  AuthenticationMethod.SESSION_OTP,
  AuthenticationMethod.TIME_BASED_OTP,
  AuthenticationMethod.WEBAUTHN,
);

export const JOI_PKCE_METHOD = Joi.string().valid(PKCEMethod.PLAIN, PKCEMethod.S256);
