import { Client } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { flatten, uniq } from "lodash";

export const createClientCredentialsToken = (
  ctx: ServerKoaContext,
  client: Client,
  scopes: Array<string>,
): JwtSignData => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: uniq(
      flatten([configuration.oauth.client_id, client.id, client.defaults.audiences]),
    ).sort(),
    client: client.id,
    expiry: configuration.defaults.expiry.client_credentials,
    scopes,
    subject: client.id,
    subjectHint: SubjectHint.CLIENT,
    tenant: client.tenantId,
    type: OpenIdTokenType.ACCESS,
  });
};
