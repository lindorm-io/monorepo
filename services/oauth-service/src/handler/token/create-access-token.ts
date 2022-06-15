import { Client, BrowserSession, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";
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
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
  });
};
