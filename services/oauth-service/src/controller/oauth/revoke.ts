import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { InvalidToken } from "../../entity";
import { JOI_GUID, JOI_JWT } from "../../common";
import { TokenType } from "../../enum";

interface RequestData {
  clientId: string;
  clientSecret: string;
  token: string;
}

export const oauthRevokeSchema = Joi.object({
  clientId: JOI_GUID.required(),
  clientSecret: Joi.string().required(),
  token: JOI_JWT.required(),
});

export const oauthRevokeController: Controller<Context<RequestData>> = async (
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
    await refreshSessionRepository.destroyMany({ id: sessionId });
  }

  return {
    body: {},
  };
};
