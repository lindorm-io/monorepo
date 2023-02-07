import Joi from "joi";
import {
  CertificateMethods,
  ChallengeStrategies,
  RdcSessionMethods,
  RdcSessionModes,
  RdcSessionTypes,
} from "@lindorm-io/common-types";

export const JOI_BIOMETRY = Joi.string().length(128);

export const JOI_CERTIFICATE_CHALLENGE = Joi.string().length(128);

export const JOI_CERTIFICATE_METHOD = Joi.string().valid(
  CertificateMethods.SHA256,
  CertificateMethods.SHA384,
  CertificateMethods.SHA512,
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
  RdcSessionMethods.POST,
  RdcSessionMethods.PUT,
  RdcSessionMethods.PATCH,
);

export const JOI_RDC_REJECT_METHOD = Joi.string().valid(
  RdcSessionMethods.DELETE,
  RdcSessionMethods.GET,
  RdcSessionMethods.PATCH,
  RdcSessionMethods.POST,
  RdcSessionMethods.PUT,
);

export const JOI_RDC_MODE = Joi.string().valid(
  RdcSessionModes.PUSH_NOTIFICATION,
  RdcSessionModes.QR_CODE,
);

export const JOI_RDC_TYPE = Joi.string().valid(RdcSessionTypes.CALLBACK, RdcSessionTypes.ENROLMENT);

export const JOI_PINCODE = Joi.string()
  .length(6)
  .pattern(/[0-9]+/);

export const JOI_STRATEGY = Joi.string().valid(
  ChallengeStrategies.IMPLICIT,
  ChallengeStrategies.PINCODE,
  ChallengeStrategies.BIOMETRY,
);
