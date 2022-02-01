import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT } from "../../common";

interface RequestData {
  id: string;
  challengeSessionToken: string;
}

export const rejectChallengeSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  challengeSessionToken: JOI_JWT.required(),
});

export const rejectChallengeController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { challengeSessionCache },
    entity: { challengeSession },
  } = ctx;

  await challengeSessionCache.destroy(challengeSession);

  return {
    body: {},
  };
};
