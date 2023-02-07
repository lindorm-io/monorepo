import { Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { LindormTokenTypes, SubjectHints } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";

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
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.REFRESH,
  });
};
