import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
}

export const deleteAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const deleteAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { authenticationSessionCache },
    entity: { authenticationSession },
  } = ctx;

  if (authenticationSession.status !== SessionStatus.PENDING) {
    throw new ClientError("Invalid Session Status");
  }

  await authenticationSessionCache.destroy(authenticationSession);
};
