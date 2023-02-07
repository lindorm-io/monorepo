import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { ClientError } from "@lindorm-io/errors";

type RequestData = {
  id: string;
};

export const deleteIdentityAddressSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const deleteIdentityAddressController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { address },
    repository: { addressRepository },
  } = ctx;

  if (address.primary) {
    throw new ClientError("Invalid request", {
      description: "Unable to delete primary address",
    });
  }

  await addressRepository.destroy(address);
};
