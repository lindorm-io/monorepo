import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentityPermission, JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
  active: boolean;
  permissions: Array<IdentityPermission>;
}

export const identityAdminSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  active: Joi.boolean().optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

export const identityAdminController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { active, permissions },
    entity: { identity },
    repository: { identityRepository },
  } = ctx;

  if (active !== undefined) {
    identity.active = active;
  }

  if (permissions !== undefined) {
    identity.permissions = permissions;
  }

  await identityRepository.update(identity);

  return { body: {} };
};
