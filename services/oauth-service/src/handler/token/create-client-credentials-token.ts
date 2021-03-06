import { Client } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { ServerKoaContext } from "../../types";
import { SubjectHint, TokenType } from "../../common";
import { configuration } from "../../server/configuration";

export const createClientCredentialsToken = (
  ctx: ServerKoaContext,
  client: Client,
  scopes: Array<string>,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: [client.id],
    expiry: configuration.defaults.expiry.client_credentials,
    permissions: client.permissions,
    scopes,
    subject: client.id,
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
  });
};
