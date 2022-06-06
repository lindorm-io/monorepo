import Joi from "joi";
import { Address } from "../../entity";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

interface RequestData {
  careOf: string | null;
  country: string | null;
  label: string | null;
  locality: string | null;
  postalCode: string | null;
  region: string | null;
  streetAddress: Array<string>;
}

interface ResponseBody {
  addressId: string;
}

export const createIdentityAddressSchema = Joi.object<RequestData>()
  .keys({
    careOf: Joi.string().allow(null).required(),
    country: Joi.string().allow(null).required(),
    label: Joi.string().allow(null).required(),
    locality: Joi.string().allow(null).required(),
    postalCode: Joi.string().allow(null).required(),
    region: Joi.string().allow(null).required(),
    streetAddress: Joi.array().items(Joi.string()).required(),
  })
  .required();

export const createIdentityAddressController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { careOf, country, label, locality, postalCode, region, streetAddress },
    entity: { identity },
    repository: { addressRepository },
  } = ctx;

  const amount = await addressRepository.count({ identityId: identity.id });

  const address = await addressRepository.create(
    new Address({
      careOf,
      country,
      identityId: identity.id,
      label,
      locality,
      postalCode,
      primary: amount < 1,
      region,
      streetAddress,
    }),
  );

  return {
    body: { addressId: address.id },
    status: HttpStatus.Success.CREATED,
  };
};
