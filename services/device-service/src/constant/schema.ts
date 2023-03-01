import Joi from "joi";
import {
  CertificateMethod,
  ChallengeStrategy,
  RdcSessionMethod,
  RdcSessionMode,
  RdcSessionType,
} from "@lindorm-io/common-types";

export const JOI_BIOMETRY = Joi.string().length(128);

export const JOI_CERTIFICATE_CHALLENGE = Joi.string().length(128);

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
  RdcSessionMethod.POST,
  RdcSessionMethod.PUT,
  RdcSessionMethod.PATCH,
);

export const JOI_RDC_REJECT_METHOD = Joi.string().valid(
  RdcSessionMethod.DELETE,
  RdcSessionMethod.GET,
  RdcSessionMethod.PATCH,
  RdcSessionMethod.POST,
  RdcSessionMethod.PUT,
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
