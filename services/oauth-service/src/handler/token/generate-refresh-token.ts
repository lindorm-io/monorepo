import { Client, ClientSession, OpaqueToken } from "../../entity";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { expiryDate } from "@lindorm-io/expiry";
import { createOpaqueTokenString } from "../../util";
import { OpaqueTokenType } from "../../enum";

export const generateRefreshToken = async (
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
      expires: expiryDate(
        client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
      ),
      token: createOpaqueTokenString(),
      type: OpaqueTokenType.REFRESH,
    }),
  );
};
