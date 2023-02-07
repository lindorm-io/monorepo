import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../common";
import { RejectChallengeRequestBody, RejectChallengeRequestParams } from "@lindorm-io/common-types";

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
    cache: { challengeSessionCache },
    entity: { challengeSession },
  } = ctx;

  await challengeSessionCache.destroy(challengeSession);
};
