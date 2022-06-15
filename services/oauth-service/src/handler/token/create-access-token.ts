import { BrowserSession, Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { SubjectHint, TokenType } from "../../common";
import { configuration } from "../../server/configuration";
import { getAdjustedAccessLevel } from "../../util";
import { getUnixTime } from "date-fns";

interface Options {
  permissions: Array<string>;
  scopes: Array<string>;
}

export const createAccessToken = (
  ctx: ServerKoaContext,
  client: Client,
  session: BrowserSession | RefreshSession,
  options: Options,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    adjustedAccessLevel: getAdjustedAccessLevel(session),
    audiences: [client.id],
    authTime: getUnixTime(session.latestAuthentication),
    expiry: client.expiry.accessToken || configuration.defaults.expiry.access_token,
    levelOfAssurance: session.levelOfAssurance,
    permissions: options.permissions,
    scopes: options.scopes,
    sessionId: session.id,
    sessionHint: session instanceof BrowserSession ? SessionHint.BROWSER : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
  });
};
