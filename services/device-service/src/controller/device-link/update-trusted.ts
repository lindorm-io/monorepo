import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT } from "../../common";
import { assertConfirmationTokenFactorLength } from "../../util";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
}

export const updateDeviceLinkTrustedSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    challengeConfirmationToken: JOI_JWT.required(),
  })
  .required();

export const updateDeviceLinkTrustedController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { deviceLink },
    repository: { deviceLinkRepository },
    token: { challengeConfirmationToken },
  } = ctx;

  assertConfirmationTokenFactorLength(challengeConfirmationToken, 2);

  deviceLink.trusted = true;

  await deviceLinkRepository.update(deviceLink);
};
