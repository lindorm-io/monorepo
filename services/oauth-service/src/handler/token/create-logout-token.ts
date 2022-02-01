import { BrowserSession, Client, RefreshSession } from "../../entity";
import { Context } from "../../types";
import { IssuerSignData } from "@lindorm-io/jwt";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";

export const createLogoutToken = (
  ctx: Context,
  client: Client,
  session: BrowserSession | RefreshSession,
): IssuerSignData => {
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
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.LOGOUT,
  });
};
