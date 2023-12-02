import Joi from "joi";

export const signatureHeadersSchema = Joi.object()
  .keys({
    date: Joi.string(),
    digest: Joi.string(),
    signature: Joi.string(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();
