import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  active: boolean;
};

export const identityAdminSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    active: Joi.boolean().optional(),
  })
  .required();

export const identityAdminController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { active },
    entity: { identity },
    repository: { identityRepository },
  } = ctx;

  if (active !== undefined) {
    identity.active = active;
  }

  await identityRepository.update(identity);
};
