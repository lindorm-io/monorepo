import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { JOI_BIOMETRY } from "../../constant";
import { JOI_JWT } from "../../common";
import { assertConfirmationTokenFactorLength } from "../../util";
import { vaultGetSalt } from "../../handler";
import { ClientError } from "@lindorm-io/errors";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
  biometry: string;
}

export const updateDeviceLinkBiometrySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
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
    metadata,
    repository: { deviceLinkRepository },
    token: { bearerToken, challengeConfirmationToken },
  } = ctx;

  if (deviceLink.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  if (deviceLink.id !== challengeConfirmationToken.claims.deviceLinkId) {
    throw new ClientError("Invalid confirmation token");
  }

  if (deviceLink.id !== metadata.device.linkId) {
    throw new ClientError("Invalid metadata");
  }

  assertConfirmationTokenFactorLength(challengeConfirmationToken, 2);

  const salt = await vaultGetSalt(ctx, deviceLink);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  deviceLink.biometry = await crypto.encrypt(biometry);

  if (metadata.device.name) {
    deviceLink.name = metadata.device.name;
  }

  await deviceLinkRepository.update(deviceLink);
};
