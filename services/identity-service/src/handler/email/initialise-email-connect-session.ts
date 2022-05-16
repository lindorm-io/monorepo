import { ClientError } from "@lindorm-io/errors";
import { ConnectSession, Email, Identity } from "../../entity";
import { ServerKoaContext } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { IdentifierType } from "../../common";
import { initialiseConnectSession } from "../connect-session";

export const initialiseEmailConnectSession = async (
  ctx: ServerKoaContext,
  identity: Identity,
  email: string,
): Promise<ConnectSession> => {
  const {
    repository: { emailRepository },
  } = ctx;

  let entity: Email;

  try {
    entity = await emailRepository.find({ email });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    entity = await emailRepository.create(
      new Email({
        identityId: identity.id,
        email,
        primary: false,
        verified: false,
      }),
    );
  }

  if (entity.verified) {
    throw new ClientError("Email is already verified");
  }

  return await initialiseConnectSession(ctx, identity, {
    identifier: entity.email,
    type: IdentifierType.EMAIL,
  });
};
