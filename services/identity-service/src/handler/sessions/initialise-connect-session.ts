import { ConnectSession, Identifier } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { argon } from "../../instance";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { isIdentifierStoredSeparately } from "../../util";

export const initialiseConnectSession = async (
  ctx: ServerKoaContext,
  identifier: Identifier,
  code: string,
): Promise<ConnectSession> => {
  const {
    cache: { connectSessionCache },
  } = ctx;

  if (!isIdentifierStoredSeparately(identifier.type)) {
    throw new ServerError("Invalid identifier type", {
      debug: { type: identifier.type },
    });
  }

  const expires = expiryDate(configuration.defaults.connect_identifier_session_expiry);

  return await connectSessionCache.create(
    new ConnectSession({
      code: await argon.encrypt(code),
      expires,
      identifierId: identifier.id,
    }),
  );
};
