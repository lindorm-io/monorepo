import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { DeleteAddressRequestParams } from "@lindorm-io/common-types";

type RequestData = DeleteAddressRequestParams;

export const deleteAddressSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .options({ abortEarly: false })
  .required();

export const deleteAddressController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { address },
    mongo: { addressRepository },
  } = ctx;

  await addressRepository.destroy(address);
};
