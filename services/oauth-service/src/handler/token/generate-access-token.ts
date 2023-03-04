import { ServerKoaContext } from "../../types";
import { Client, ClientSession, OpaqueToken } from "../../entity";
import { createOpaqueTokenString } from "../../util";
import { expiryDate } from "@lindorm-io/expiry";
import { configuration } from "../../server/configuration";
import { OpaqueTokenType } from "../../enum";

export const generateAccessToken = async (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
): Promise<OpaqueToken> => {
  const {
    cache: { opaqueTokenCache },
  } = ctx;

  return await opaqueTokenCache.create(
    new OpaqueToken({
      clientSessionId: clientSession.id,
      expires: expiryDate(client.expiry.accessToken || configuration.defaults.expiry.access_token),
      token: createOpaqueTokenString(),
      type: OpaqueTokenType.ACCESS,
    }),
  );
};
