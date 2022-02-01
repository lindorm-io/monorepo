import { Client, BrowserSession, RefreshSession } from "../../entity";
import { Context } from "../../types";
import { IssuerSignData } from "@lindorm-io/jwt";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";
import { configuration } from "../../configuration";

interface Options {
  permissions: Array<string>;
  scopes: Array<string>;
}

export const createAccessToken = (
  ctx: Context,
  client: Client,
  session: BrowserSession | RefreshSession,
  options: Options,
): IssuerSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: [client.id],
    expiry: client.expiry.accessToken || configuration.expiry.access_token,
    levelOfAssurance: session.levelOfAssurance,
    permissions: options.permissions,
    scopes: options.scopes,
    sessionId: session.id,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
  });
};
