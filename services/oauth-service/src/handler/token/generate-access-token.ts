import { Client, ClientSession, OpaqueToken } from "../../entity";
import { OpaqueTokenType } from "../../enum";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { createOpaqueToken } from "../../util";
import { expiryDate } from "@lindorm-io/expiry";

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
      expires: expiryDate(client.expiry.accessToken || configuration.defaults.expiry.access_token),
      token: createOpaqueToken(),
      type: OpaqueTokenType.ACCESS,
    }),
  );
};
