import { BrowserSession, Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { SubjectHint, TokenType } from "../../common";
import { configuration } from "../../server/configuration";
import { getAdjustedAccessLevel } from "../../util";
import { getUnixTime } from "date-fns";
import { randomString } from "@lindorm-io/core";

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
    nonce: session.nonce || randomString(16),
    permissions: options.permissions,
    scopes: options.scopes,
    sessionId: session.id,
    sessionHint: session instanceof BrowserSession ? SessionHint.BROWSER : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
  });
};
