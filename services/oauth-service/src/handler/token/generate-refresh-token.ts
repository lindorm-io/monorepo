import { Client, ClientSession, OpaqueToken } from "../../entity";
import { OpaqueTokenType } from "../../enum";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { createOpaqueToken } from "../../util";
import { expiryDate } from "@lindorm-io/expiry";

export const generateRefreshToken = async (
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
      expires: expiryDate(
        client.expiry.refreshToken || configuration.defaults.expiry.refresh_session,
      ),
      token: createOpaqueToken(),
      type: OpaqueTokenType.REFRESH,
    }),
  );
};
