import { CryptoLayered } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_JWT } from "../../common";
import { JOI_BIOMETRY } from "../../constant";
import { getDeviceHeaders, vaultGetSalt } from "../../handler";
import { ServerKoaController } from "../../types";
import { assertConfirmationTokenFactorLength } from "../../util";

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
    mongo: { deviceLinkRepository },
    token: { bearerToken, challengeConfirmationToken },
  } = ctx;

  if (deviceLink.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  if (deviceLink.id !== challengeConfirmationToken.claims.deviceLinkId) {
    throw new ClientError("Invalid confirmation token");
  }

  const { linkId, name } = getDeviceHeaders(ctx);

  if (deviceLink.id !== linkId) {
    throw new ClientError("Invalid metadata");
  }

  assertConfirmationTokenFactorLength(challengeConfirmationToken, 2);

  const salt = await vaultGetSalt(ctx, deviceLink);
  const crypto = new CryptoLayered({
    aes: { secret: salt.aes },
    sha: { secret: salt.sha },
  });

  deviceLink.biometry = await crypto.encrypt(biometry);

  if (name) {
    deviceLink.name = name;
  }

  await deviceLinkRepository.update(deviceLink);
};
