import { Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import { IssuerSignData } from "@lindorm-io/jwt";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";
import { configuration } from "../../server/configuration";

export const createClientCredentialsToken = (
  ctx: ServerKoaContext,
  client: Client,
): IssuerSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: [client.id],
    expiry: configuration.defaults.client_credentials_expiry,
    permissions: client.permissions,
    scopes: client.allowed.scopes,
    subject: client.id,
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
  });
};
