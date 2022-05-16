import { Client, BrowserSession, RefreshSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { IssuerSignData } from "@lindorm-io/jwt";
import { IdentityServiceClaims, SubjectHint } from "../../common";
import { TokenType } from "../../enum";
import { configuration } from "../../server/configuration";

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
): IssuerSignData => {
  const { jwt } = ctx;

  const { sub, updatedAt, ...claims } = options.claims;

  return jwt.sign({
    audiences: [client.id],
    authContextClass: session.acrValues,
    authMethodsReference: session.amrValues,
    claims: claims,
    expiry: client.expiry.idToken || configuration.expiry.id_token,
    levelOfAssurance: session.levelOfAssurance,
    nonce: options.nonce,
    scopes: options.scopes,
    sessionId: session.id,
    subject: session.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.IDENTITY,
  });
};
