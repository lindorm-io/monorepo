import { BrowserSession, Client, RefreshSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { LindormTokenTypes, SubjectHints } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { configuration } from "../../server/configuration";
import { flatten, uniq } from "lodash";
import { getAdjustedAccessLevel } from "../../util";
import { getUnixTime } from "date-fns";
import { randomString } from "@lindorm-io/random";

type Options = {
  audiences: Array<string>;
  scopes: Array<string>;
};

export const createAccessToken = (
  ctx: ServerKoaContext,
  client: Client,
  session: BrowserSession | RefreshSession,
  options: Options,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    adjustedAccessLevel: getAdjustedAccessLevel(session),
    audiences: uniq(flatten([client.id, options.audiences, configuration.oauth.client_id])).sort(),
    authTime: getUnixTime(session.latestAuthentication),
    expiry: client.expiry.accessToken || configuration.defaults.expiry.access_token,
    levelOfAssurance: session.levelOfAssurance,
    nonce: session.nonce || randomString(16),
    scopes: options.scopes,
    sessionId: session.id,
    sessionHint: session instanceof BrowserSession ? SessionHint.BROWSER : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.ACCESS,
  });
};
