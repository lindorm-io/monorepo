import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { UpdateAddressRequestBody, UpdateAddressRequestParams } from "@lindorm-io/common-types";

type RequestData = UpdateAddressRequestParams & UpdateAddressRequestBody;

export const updateAddressSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    careOf: Joi.string().allow(null).required(),
    country: Joi.string().allow(null).required(),
    label: Joi.string().allow(null).required(),
    locality: Joi.string().allow(null).required(),
    postalCode: Joi.string().allow(null).required(),
    region: Joi.string().allow(null).required(),
    streetAddress: Joi.array().items(Joi.string()).required(),
  })
  .options({ abortEarly: false })
  .required();

export const updateAddressController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { careOf, country, label, locality, postalCode, region, streetAddress },
    entity: { address },
    mongo: { addressRepository },
  } = ctx;

  address.careOf = careOf;
  address.country = country;
  address.label = label;
  address.locality = locality;
  address.postalCode = postalCode;
  address.region = region;
  address.streetAddress = streetAddress;

  await addressRepository.update(address);
};
