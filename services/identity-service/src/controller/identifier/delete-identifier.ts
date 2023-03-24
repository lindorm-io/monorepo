import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { DeleteIdentifierRequestParams } from "@lindorm-io/common-types";

type RequestData = DeleteIdentifierRequestParams;

export const deleteIdentifierSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .options({ abortEarly: false })
  .required();

export const deleteIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { identifier },
    mongo: { identifierRepository },
  } = ctx;

  if (identifier.primary) {
    throw new ClientError("Invalid request", {
      description: "Unable to delete primary identifier",
    });
  }

  await identifierRepository.destroy(identifier);
};
