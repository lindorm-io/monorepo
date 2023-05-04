import { expiryDate } from "@lindorm-io/expiry";
import { Client, ClientSession, OpaqueToken } from "../../entity";
import { OpaqueTokenType } from "../../enum";
import { ServerKoaContext } from "../../types";
import { createOpaqueToken } from "../../util";

export const generateAccessToken = async (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
): Promise<OpaqueToken> => {
  const {
    redis: { opaqueTokenCache },
  } = ctx;

  return await opaqueTokenCache.create(
    new OpaqueToken({
      clientSessionId: clientSession.id,
      expires: expiryDate(client.expiry.accessToken),
      token: createOpaqueToken(),
      type: OpaqueTokenType.ACCESS,
    }),
  );
};
