import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { CryptoLayered } from "@lindorm-io/crypto";
import { JOI_GUID, JOI_JWT } from "../../common";
import { JOI_PINCODE } from "../../constant";
import { assertConfirmationTokenFactorLength } from "../../util";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
  pincode: string;
}

export const updateDeviceLinkPincodeSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  challengeConfirmationToken: JOI_JWT.required(),
  pincode: JOI_PINCODE.required(),
});

export const updateDeviceLinkPincodeController: Controller<Context<RequestData>> = async (
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

  const crypto = new CryptoLayered({
    aes: { secret: deviceLink.salt.aes },
    sha: { secret: deviceLink.salt.sha },
  });

  deviceLink.pincode = await crypto.encrypt(pincode);
  deviceLink.name = name;

  await deviceLinkRepository.update(deviceLink);

  return {
    body: {},
  };
};
