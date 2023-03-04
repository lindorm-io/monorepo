import { OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { uniqArray } from "@lindorm-io/core";

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
