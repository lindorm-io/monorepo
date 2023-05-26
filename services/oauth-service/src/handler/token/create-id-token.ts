import { LindormClaims, OpenIdTokenType, SubjectHint } from "@lindorm-io/common-types";
import { JwtSignData } from "@lindorm-io/jwt";
import { getUnixTime } from "date-fns";
import { Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const createIdToken = (
  ctx: ServerKoaContext,
  client: Client,
  clientSession: ClientSession,
  claims: Partial<LindormClaims>,
  accessToken?: string,
): JwtSignData => {
  const { jwt } = ctx;
  const { sub, updatedAt, ...rest } = claims;
  const atHash = accessToken ? jwt.createHash(accessToken) : undefined;

  return jwt.sign({
    atHash,
    audiences: clientSession.audiences,
    authContextClass: `loa_${clientSession.levelOfAssurance}`,
    authMethodsReference: clientSession.methods,
    authorizedParty: client.id,
    authTime: getUnixTime(clientSession.latestAuthentication),
    claims: rest,
    client: client.id,
    expiry: client.expiry.idToken,
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
