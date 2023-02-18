import Joi from "joi";
import { ServerKoaController } from "../../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { InvalidToken } from "../../../entity";
import { JOI_JWT } from "../../../common";
import { fromUnixTime } from "date-fns";
import { LindormTokenTypes, RevokeTokenRequestBody } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

type RequestData = RevokeTokenRequestBody;

export const oauthRevokeSchema = Joi.object<RequestData>()
  .keys({
    clientId: Joi.string().guid().required(),
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

  const { id, expires, session, type } = jwt.verify(data.token, {
    types: [LindormTokenTypes.ACCESS, LindormTokenTypes.REFRESH],
  });

  if (!session) {
    throw new ClientError("Invalid Token", {
      code: "invalid_token",
      description: "Token claim is missing",
      data: { session },
    });
  }

  await invalidTokenCache.create(new InvalidToken({ id, expires: fromUnixTime(expires) }));

  if (type === LindormTokenTypes.REFRESH) {
    await refreshSessionRepository.deleteMany({ id: session });
  }
};
