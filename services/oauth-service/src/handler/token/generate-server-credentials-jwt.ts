import { OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

export const generateServerCredentialsJwt = (
  ctx: ServerKoaContext,
  audiences: Array<string> = [],
  scopes: Array<string> = [],
): string => {
  const { jwt } = ctx;

  const { token } = jwt.sign({
    audiences: uniqArray([configuration.oauth.client_id], audiences),
    client: configuration.oauth.client_id,
    expiry: configuration.defaults.expiry.client_credentials,
    scopes,
    subject: configuration.oauth.client_id,
    subjectHint: SubjectHint.CLIENT,
    type: OpenIdTokenType.ACCESS,
  });

  return token;
};
