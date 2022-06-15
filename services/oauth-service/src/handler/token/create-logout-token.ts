import { BrowserSession, Client, RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { JwtSignData } from "@lindorm-io/jwt";
import { SessionHint } from "../../enum";
import { SubjectHint, TokenType } from "../../common";

export const createLogoutToken = (
  ctx: ServerKoaContext,
  client: Client,
  session: BrowserSession | RefreshSession,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: [client.id],
    claims: {
      events: {
        "http://schemas.openid.net/event/backchannel-logout": {},
      },
    },
    expiry: "60 seconds",
    sessionId: session.id,
    sessionHint: session instanceof BrowserSession ? SessionHint.BROWSER : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.LOGOUT,
  });
};
