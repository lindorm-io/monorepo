import { Client, RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { JwtSignData } from "@lindorm-io/jwt";
import { SubjectHint, TokenType } from "../../common";

export const createRefreshToken = (
  ctx: ServerKoaContext,
  client: Client,
  refreshSession: RefreshSession,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    id: refreshSession.tokenId,
    audiences: [client.id],
    expiry: refreshSession.expires,
    sessionId: refreshSession.id,
    subject: refreshSession.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REFRESH,
  });
};
