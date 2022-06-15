import { Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
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
    sessionHint: SessionHint.REFRESH,
    subject: refreshSession.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REFRESH,
  });
};
