import { Client, ClientSession } from "../../entity";
import { JwtSignData } from "@lindorm-io/jwt";
import { LindormClaims, OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { getUnixTime } from "date-fns";
import { uniqArray } from "@lindorm-io/core";

export const createIdToken = (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
  claims: Partial<LindormClaims>,
): JwtSignData => {
  const { jwt } = ctx;
  const { sub, updatedAt, ...rest } = claims;

  return jwt.sign({
    audiences: uniqArray(
      client.id,
      clientSession.audiences,
      configuration.oauth.client_id,
      configuration.services.authentication_service.client_id,
      configuration.services.identity_service.client_id,
    ),
    authContextClass: `loa_${clientSession.levelOfAssurance}`,
    authMethodsReference: clientSession.methods,
    authTime: getUnixTime(clientSession.latestAuthentication),
    authorizedParty: client.id,
    claims: rest,
    client: client.id,
    expiry: client.expiry.idToken || configuration.defaults.expiry.id_token,
    levelOfAssurance: clientSession.levelOfAssurance,
    nonce: clientSession.nonce,
    scopes: clientSession.scopes,
    session: clientSession.id,
    sessionHint: clientSession.type,
    subject: clientSession.identityId,
    subjectHint: SubjectHint.IDENTITY,
    tenant: client.tenantId,
    type: OpenIdTokenType.ID,
  });
};
