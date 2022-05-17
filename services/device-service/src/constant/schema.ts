import Joi from "joi";
import { CertificateMethod } from "../enum";
import { ChallengeStrategy, RdcSessionMode, RdcSessionType, RequestMethod } from "../common";

export const JOI_BIOMETRY = Joi.string().base64().length(128);

export const JOI_CERTIFICATE_CHALLENGE = Joi.string().base64().length(128);

export const JOI_CERTIFICATE_METHOD = Joi.string().valid(
  CertificateMethod.SHA256,
  CertificateMethod.SHA384,
  CertificateMethod.SHA512,
);

export const JOI_DEVICE_METADATA = Joi.object({
  brand: Joi.string().allow(null).required(),
  buildId: Joi.string().allow(null).required(),
  buildNumber: Joi.string().allow(null).required(),
  macAddress: Joi.string().allow(null).required(),
  model: Joi.string().allow(null).required(),
  systemName: Joi.string().allow(null).required(),
});

export const JOI_FACTORS = Joi.number().valid(1, 2);

export const JOI_RDC_CONFIRM_METHOD = Joi.string().valid(
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
);

export const JOI_RDC_REJECT_METHOD = Joi.string().valid(
  RequestMethod.DELETE,
  RequestMethod.GET,
  RequestMethod.PATCH,
  RequestMethod.POST,
  RequestMethod.PUT,
);

export const JOI_RDC_MODE = Joi.string().valid(
  RdcSessionMode.PUSH_NOTIFICATION,
  RdcSessionMode.QR_CODE,
);

export const JOI_RDC_TYPE = Joi.string().valid(RdcSessionType.CALLBACK, RdcSessionType.ENROLMENT);

export const JOI_PINCODE = Joi.string()
  .length(6)
  .pattern(/[0-9]+/);

export const JOI_STRATEGY = Joi.string().valid(
  ChallengeStrategy.IMPLICIT,
  ChallengeStrategy.PINCODE,
  ChallengeStrategy.BIOMETRY,
);
