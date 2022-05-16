import { Client, RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { IssuerSignData } from "@lindorm-io/jwt";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";

export const createRefreshToken = (
  ctx: ServerKoaContext,
  client: Client,
  refreshSession: RefreshSession,
): IssuerSignData => {
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
