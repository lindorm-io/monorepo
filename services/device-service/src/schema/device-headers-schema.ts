import Joi from "joi";

export const deviceHeadersSchema = Joi.object()
  .keys({
    "x-device-installation-id": Joi.string().required(),
    "x-device-name": Joi.string().required(),
    "x-device-system-version": Joi.string().required(),
    "x-device-unique-id": Joi.string().required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const deviceHeadersEnrolledSchema = Joi.object()
  .keys({
    "x-device-installation-id": Joi.string().required(),
    "x-device-link-id": Joi.string().required(),
    "x-device-name": Joi.string().required(),
    "x-device-system-version": Joi.string().required(),
    "x-device-unique-id": Joi.string().required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();
