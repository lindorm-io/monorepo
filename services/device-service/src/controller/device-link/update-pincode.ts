import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { JOI_JWT } from "../../common";
import { JOI_PINCODE } from "../../constant";
import { assertConfirmationTokenFactorLength } from "../../util";
import { vaultGetSalt } from "../../handler";
import { ClientError } from "@lindorm-io/errors";

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
    metadata,
    mongo: { deviceLinkRepository },
    token: { bearerToken, challengeConfirmationToken },
  } = ctx;

  if (deviceLink.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  if (deviceLink.id !== challengeConfirmationToken.claims.deviceLinkId) {
    throw new ClientError("Invalid confirmation token");
  }

  assertConfirmationTokenFactorLength(challengeConfirmationToken, 2);

  const salt = await vaultGetSalt(ctx, deviceLink);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  deviceLink.pincode = await crypto.encrypt(pincode);

  if (metadata.device.name) {
    deviceLink.name = metadata.device.name;
  }

  await deviceLinkRepository.update(deviceLink);
};
