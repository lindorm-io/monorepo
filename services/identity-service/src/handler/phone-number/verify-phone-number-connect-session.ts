import { ClientError } from "@lindorm-io/errors";
import { ConnectSession } from "../../entity";
import { Context } from "../../types";
import { argon } from "../../instance";

export const verifyPhoneNumberConnectSession = async (
  ctx: Context,
  session: ConnectSession,
  code: string,
): Promise<void> => {
  const {
    repository: { phoneNumberRepository },
  } = ctx;

  await argon.assert(code, session.code);

  const entity = await phoneNumberRepository.find({ phoneNumber: session.identifier });

  if (entity.verified) {
    throw new ClientError("Phone number is already verified");
  }

  entity.verified = true;

  await phoneNumberRepository.update(entity);
};
