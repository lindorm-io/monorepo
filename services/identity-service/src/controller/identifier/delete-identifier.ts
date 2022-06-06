import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";

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

  await identifierRepository.destroy(identifier);
};
