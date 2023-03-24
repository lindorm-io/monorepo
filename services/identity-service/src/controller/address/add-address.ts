import Joi from "joi";
import { Address } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { AddAddressRequestBody } from "@lindorm-io/common-types";

type RequestData = AddAddressRequestBody;

export const addAddressSchema = Joi.object<RequestData>()
  .keys({
    identityId: Joi.string().guid().required(),
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

export const addAddressController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { careOf, country, label, locality, postalCode, region, streetAddress },
    entity: { identity },
    mongo: { addressRepository },
  } = ctx;

  const amount = await addressRepository.count({ identityId: identity.id });

  await addressRepository.create(
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
};
