import { expiryDate } from "@lindorm-io/expiry";
import { CreateOpaqueToken } from "@lindorm-io/jwt";
import { Client, ClientSession, OpaqueToken } from "../../entity";
import { OpaqueTokenType } from "../../enum";
import { ServerKoaContext } from "../../types";

export const generateRefreshToken = async (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
  opaqueToken: CreateOpaqueToken,
): Promise<OpaqueToken> => {
  const {
    redis: { opaqueTokenCache },
  } = ctx;

  return await opaqueTokenCache.create(
    new OpaqueToken({
      id: opaqueToken.id,
      clientSessionId: clientSession.id,
      expires: expiryDate(client.expiry.refreshToken),
      signature: opaqueToken.signature,
      type: OpaqueTokenType.REFRESH,
    }),
  );
};
