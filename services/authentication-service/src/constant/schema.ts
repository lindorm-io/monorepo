import Joi from "joi";
import { FlowType } from "../enum";
import { PKCEMethod } from "@lindorm-io/core";

export const JOI_FLOW_TYPE = Joi.string().valid(
  FlowType.BANK_ID_SE,
  FlowType.DEVICE_CHALLENGE,
  FlowType.EMAIL_LINK,
  FlowType.EMAIL_OTP,
  FlowType.MFA_COOKIE,
  FlowType.PASSWORD,
  FlowType.PASSWORD_BROWSER_LINK,
  FlowType.PHONE_OTP,
  FlowType.RDC_QR_CODE,
  FlowType.SESSION_ACCEPT_WITH_CODE,
  FlowType.SESSION_OTP,
  FlowType.TIME_BASED_OTP,
  FlowType.WEBAUTHN,
);

export const JOI_PKCE_METHOD = Joi.string().valid(PKCEMethod.PLAIN, PKCEMethod.S256);
