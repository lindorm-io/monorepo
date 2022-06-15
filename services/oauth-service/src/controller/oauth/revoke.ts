import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { InvalidToken } from "../../entity";
import { JOI_GUID, JOI_JWT, TokenType } from "../../common";

interface RequestData {
  clientId: string;
  clientSecret: string;
  token: string;
}

export const oauthRevokeSchema = Joi.object()
  .keys({
    clientId: JOI_GUID.required(),
    clientSecret: Joi.string().required(),
    token: JOI_JWT.required(),
  })
  .required();

export const oauthRevokeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { invalidTokenCache },
    data,
    jwt,
    repository: { refreshSessionRepository },
  } = ctx;

  const { id, expiresIn, sessionId, type } = jwt.verify(data.token, {
    types: [TokenType.ACCESS, TokenType.REFRESH],
  });

  await invalidTokenCache.create(new InvalidToken({ id }), expiresIn);

  if (type === TokenType.REFRESH) {
    await refreshSessionRepository.deleteMany({ id: sessionId });
  }
};
