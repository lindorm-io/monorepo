import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { ClientError } from "@lindorm-io/errors";

type RequestData = {
  id: string;
};

export const deleteIdentifierSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const deleteIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { identifier },
    repository: { identifierRepository },
  } = ctx;

  if (identifier.primary) {
    throw new ClientError("Invalid request", {
      description: "Unable to delete primary identifier",
    });
  }

  await identifierRepository.destroy(identifier);
};
