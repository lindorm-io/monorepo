import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";

type RequestData = {
  id: string;
  careOf: string | null;
  country: string | null;
  label: string | null;
  locality: string | null;
  postalCode: string | null;
  region: string | null;
  streetAddress: Array<string>;
};

export const updateIdentityAddressSchema = Joi.object<RequestData>()
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
  .required();

export const updateIdentityAddressController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { careOf, country, label, locality, postalCode, region, streetAddress },
    entity: { address },
    repository: { addressRepository },
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
