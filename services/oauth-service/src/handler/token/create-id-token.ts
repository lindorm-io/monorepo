import { Client, BrowserSession, RefreshSession } from "../../entity";
import { IdentityServiceClaims, SubjectHint, TokenType } from "../../common";
import { JwtSignData } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { SessionHint } from "../../enum";
import { configuration } from "../../server/configuration";
import { getUnixTime } from "date-fns";

interface Options {
  claims: Partial<IdentityServiceClaims>;
  nonce: string;
  scopes: Array<string>;
}

export const createIdToken = (
  ctx: ServerKoaContext,
  client: Client,
  session: BrowserSession | RefreshSession,
  options: Options,
): JwtSignData => {
  const { jwt } = ctx;

  const { sub, updatedAt, ...claims } = options.claims;

  return jwt.sign({
    audiences: [client.id],
    authContextClass: session.acrValues,
    authMethodsReference: session.amrValues,
    authTime: getUnixTime(session.latestAuthentication),
    claims: claims,
    expiry: client.expiry.idToken || configuration.defaults.expiry.id_token,
    levelOfAssurance: session.levelOfAssurance,
    nonce: options.nonce,
    scopes: options.scopes,
    sessionId: session.id,
    sessionHint: session instanceof BrowserSession ? SessionHint.BROWSER : SessionHint.REFRESH,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.IDENTITY,
  });
};
