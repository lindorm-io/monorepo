import { OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { JwtSign } from "@lindorm-io/jwt";
import { Client } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

export const createClientCredentialsToken = (
  ctx: ServerKoaContext,
  client: Client,
  scopes: Array<string>,
): JwtSign => {
  const { jwt } = ctx;

  return jwt.sign({
    audiences: uniqArray(
      client.id,
      client.audiences.credentials,
      configuration.oauth.client_id,
      configuration.services.authentication_service.client_id,
      configuration.services.identity_service.client_id,
    ),
    client: client.id,
    expiry: configuration.defaults.expiry.client_credentials,
    scopes,
    subject: client.id,
    subjectHint: SubjectHint.CLIENT,
    tenant: client.tenantId,
    type: OpenIdTokenType.ACCESS,
  });
};
