import Joi from "joi";
import { LindormKoaMetadataHeaders, MetadataHeader } from "@lindorm-io/koa";

export const deviceHeadersSchema = Joi.object<LindormKoaMetadataHeaders>()
  .keys({
    [MetadataHeader.DEVICE_INSTALLATION_ID]: Joi.string().required(),
    [MetadataHeader.DEVICE_IP]: Joi.string().required(),
    [MetadataHeader.DEVICE_NAME]: Joi.string().required(),
    [MetadataHeader.DEVICE_SYSTEM_VERSION]: Joi.string().required(),
    [MetadataHeader.DEVICE_UNIQUE_ID]: Joi.string().required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const deviceHeadersEnrolledSchema = Joi.object<LindormKoaMetadataHeaders>()
  .keys({
    [MetadataHeader.DEVICE_INSTALLATION_ID]: Joi.string().required(),
    [MetadataHeader.DEVICE_IP]: Joi.string().required(),
    [MetadataHeader.DEVICE_LINK_ID]: Joi.string().required(),
    [MetadataHeader.DEVICE_NAME]: Joi.string().required(),
    [MetadataHeader.DEVICE_SYSTEM_VERSION]: Joi.string().required(),
    [MetadataHeader.DEVICE_UNIQUE_ID]: Joi.string().required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();
