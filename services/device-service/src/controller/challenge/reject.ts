import { RejectChallengeRequestBody, RejectChallengeRequestParams } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_JWT } from "../../common";
import { ServerKoaController } from "../../types";

type RequestData = RejectChallengeRequestParams & RejectChallengeRequestBody;

export const rejectChallengeSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    challengeSessionToken: JOI_JWT.required(),
  })
  .required();

export const rejectChallengeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { challengeSessionCache },
    entity: { challengeSession },
    token: { challengeSessionToken },
  } = ctx;

  if (challengeSession.id !== challengeSessionToken.metadata.session) {
    throw new ClientError("Invalid challenge session token");
  }

  await challengeSessionCache.destroy(challengeSession);
};
