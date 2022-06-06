import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { ClientError } from "@lindorm-io/errors";

interface RequestData {
  id: string;
}

export const deleteIdentifierSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
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
