import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { JOI_BIOMETRY } from "../../constant";
import { JOI_GUID, JOI_JWT } from "../../common";
import { assertConfirmationTokenFactorLength } from "../../util";
import { vaultGetSalt } from "../../handler";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
  biometry: string;
}

export const updateDeviceLinkBiometrySchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    challengeConfirmationToken: JOI_JWT.required(),
    biometry: JOI_BIOMETRY.required(),
  })
  .required();

export const updateDeviceLinkBiometryController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { biometry },
    entity: { deviceLink },
    metadata: {
      device: { name },
    },
    repository: { deviceLinkRepository },
    token: { challengeConfirmationToken },
  } = ctx;

  assertConfirmationTokenFactorLength(challengeConfirmationToken, 2);

  const salt = await vaultGetSalt(ctx, deviceLink);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  deviceLink.biometry = await crypto.encrypt(biometry);
  deviceLink.name = name;

  await deviceLinkRepository.update(deviceLink);
};
