import { ClientError } from "@lindorm-io/errors";
import { ConnectSession, Identity, PhoneNumber } from "../../entity";
import { ServerKoaContext } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { IdentifierType } from "../../common";
import { initialiseConnectSession } from "../connect-session";

export const initialisePhoneNumberConnectSession = async (
  ctx: ServerKoaContext,
  identity: Identity,
  phoneNumber: string,
): Promise<ConnectSession> => {
  const {
    logger,
    repository: { phoneNumberRepository },
  } = ctx;

  logger.debug("connectPhoneNumberInitialise", {
    identityId: identity.id,
    phoneNumber,
  });

  let entity: PhoneNumber;

  try {
    entity = await phoneNumberRepository.find({ phoneNumber });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    entity = await phoneNumberRepository.create(
      new PhoneNumber({
        identityId: identity.id,
        phoneNumber,
        primary: false,
        verified: false,
      }),
    );
  }

  if (entity.verified) {
    throw new ClientError("Phone number is already verified");
  }

  return await initialiseConnectSession(ctx, identity, {
    identifier: entity.phoneNumber,
    type: IdentifierType.EMAIL,
  });
};
