import { Client } from "../../entity";
import { Context } from "../../types";
import { IssuerSignData } from "@lindorm-io/jwt";
import { SubjectHint } from "../../common";
import { TokenType } from "../../enum";
import { configuration } from "../../configuration";

export const createClientCredentialsToken = (ctx: Context, client: Client): IssuerSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: [client.id],
    expiry: configuration.expiry.client_credentials,
    permissions: client.permissions,
    scopes: client.allowed.scopes,
    subject: client.id,
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
  });
};
