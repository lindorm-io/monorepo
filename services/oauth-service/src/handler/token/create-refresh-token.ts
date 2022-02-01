import { Client, RefreshSession } from "../../entity";
import { Context } from "../../types";
import { IssuerSignData } from "@lindorm-io/jwt";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";

export const createRefreshToken = (
  ctx: Context,
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
