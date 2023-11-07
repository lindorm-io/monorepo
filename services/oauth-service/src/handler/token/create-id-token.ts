import { LindormIdentityClaims, OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import { JwtSign } from "@lindorm-io/jwt";
import { getUnixTime, isAfter } from "date-fns";
import { Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getAuthenticationLevelFromLevelOfAssurance, getPrimaryFactor } from "../../util";

export const createIdToken = (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
  claims: Partial<LindormIdentityClaims>,
  accessToken?: string,
): JwtSign => {
  const { jwt } = ctx;
  const { sub, updatedAt, ...rest } = claims;

  const expires = expiryDate(client.expiry.idToken);

  return jwt.sign({
    accessToken,
    audiences: clientSession.audiences,
    authContextClass: getAuthenticationLevelFromLevelOfAssurance(clientSession.levelOfAssurance),
    authFactorReference: getPrimaryFactor(clientSession.factors),
    authMethodsReference: clientSession.methods,
    authorizedParty: client.id,
    authTime: getUnixTime(clientSession.latestAuthentication),
    claims: rest,
    client: client.id,
    code: clientSession.code || undefined,
    expiry: isAfter(expires, clientSession.expires) ? clientSession.expires : expires,
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
