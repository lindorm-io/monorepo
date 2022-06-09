import { Client, BrowserSession, RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { JwtSignData } from "@lindorm-io/jwt";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";
import { configuration } from "../../server/configuration";

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
    audiences: [client.id],
    expiry: client.expiry.accessToken || configuration.defaults.access_token_expiry,
    levelOfAssurance: session.levelOfAssurance,
    permissions: options.permissions,
    scopes: options.scopes,
    sessionId: session.id,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
  });
};
