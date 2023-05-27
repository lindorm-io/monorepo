import { expiryDate } from "@lindorm-io/expiry";
import { CreateOpaqueToken } from "@lindorm-io/jwt";
import { isAfter } from "date-fns";
import { Client, ClientSession, OpaqueToken } from "../../entity";
import { OpaqueTokenType } from "../../enum";
import { ServerKoaContext } from "../../types";

export const generateAccessToken = async (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
  opaqueToken: CreateOpaqueToken,
): Promise<OpaqueToken> => {
  const {
    redis: { opaqueTokenCache },
  } = ctx;

  const expires = expiryDate(client.expiry.accessToken);

  return await opaqueTokenCache.create(
    new OpaqueToken({
      id: opaqueToken.id,
      clientSessionId: clientSession.id,
      expires: isAfter(expires, clientSession.expires) ? clientSession.expires : expires,
      signature: opaqueToken.signature,
      type: OpaqueTokenType.ACCESS,
    }),
  );
};
