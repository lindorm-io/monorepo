import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { JOI_JWT } from "../../common";
import { JOI_PINCODE } from "../../constant";
import { assertConfirmationTokenFactorLength } from "../../util";
import { vaultGetSalt } from "../../handler";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
  pincode: string;
}

export const updateDeviceLinkPincodeSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    challengeConfirmationToken: JOI_JWT.required(),
    pincode: JOI_PINCODE.required(),
  })
  .required();

export const updateDeviceLinkPincodeController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { pincode },
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

  deviceLink.pincode = await crypto.encrypt(pincode);
  deviceLink.name = name;

  await deviceLinkRepository.update(deviceLink);
};
