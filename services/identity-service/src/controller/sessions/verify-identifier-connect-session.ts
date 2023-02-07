import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";

type RequestData = {
  id: string;
  code: string;
};

export const verifyIdentifierConnectSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    code: Joi.string().required(),
  })
  .required();

export const verifyIdentifierConnectSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { code },
    entity: { connectSession, identifier },
    repository: { identifierRepository },
  } = ctx;

  await argon.assert(code, connectSession.code);

  identifier.verified = true;

  await identifierRepository.update(identifier);
};
