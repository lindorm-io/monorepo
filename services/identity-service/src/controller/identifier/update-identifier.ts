import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { isUndefined } from "lodash";
import { setIdentifierAsPrimary } from "../../handler";

interface RequestData {
  id: string;
  label?: string | null;
  primary?: boolean;
}

export const updateIdentifierSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    label: Joi.string().allow(null).optional(),
    primary: Joi.boolean().allow(true).optional(),
  })
  .required();

export const updateIdentifierController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { label, primary },
    repository: { identifierRepository },
  } = ctx;

  let identifier = ctx.entity.identifier;

  if (!isUndefined(label)) {
    identifier.label = label;
    identifier = await identifierRepository.update(identifier);
  }

  if (!isUndefined(primary)) {
    await setIdentifierAsPrimary(ctx, identifier);
  }
};
